import os
import shutil
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import json

from app.config import settings
from app.database import (
    init_db, save_portal, list_portals, delete_portal, get_portal,
    save_skill, list_skills, delete_skill,
    save_session, list_sessions, delete_session
)
from app.agents.graph import compiled_graph
from app.agents.skill_manager import parse_and_validate_skill_yaml
from langchain_core.messages import HumanMessage

app = FastAPI(
    title="Unified Portal Agent Backend",
    description="Backend coordinator hosting compilers, databases, and WebSocket state machines.",
    version="1.0.0"
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # local network bounds
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup database provisioning
@app.on_event("startup")
def on_startup():
    init_db()

# --- REST Portals Routing ---
class PortalInput(BaseModel):
    id: str
    name: str
    base_url: str
    headers: Dict[str, str]
    swagger_doc: Optional[str] = None

@app.post("/api/portals")
def register_new_portal(portal: PortalInput):
    try:
        save_portal(portal.id, portal.name, portal.base_url, portal.headers, portal.swagger_doc)
        return {"success": True, "message": f"Portal '{portal.name}' registered successfully."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/api/portals")
def get_all_portals():
    return list_portals()

@app.delete("/api/portals/{portal_id}")
def remove_portal(portal_id: str):
    delete_portal(portal_id)
    return {"success": True, "message": "Portal removed."}

# --- REST Skills Routing ---
@app.post("/api/skills")
async def register_new_skill(
    portal_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        yaml_content = (await file.read()).decode("utf-8")
        # Validate syntax & fields structure using Pydantic compiler
        skill_data = parse_and_validate_skill_yaml(yaml_content)
        
        save_skill(
            skill_id=skill_data["id"],
            portal_id=portal_id,
            name=skill_data["name"],
            description=skill_data["description"],
            yaml_content=yaml_content
        )
        return {"success": True, "skill_id": skill_data["id"]}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Skill compilation failure: {exc}")

@app.get("/api/skills")
def get_all_skills(portal_id: Optional[str] = None):
    return list_skills(portal_id)

class SkillGenerateInput(BaseModel):
    portal_id: str
    prompt: str
    model_provider: Optional[str] = "gemini"

@app.post("/api/skills/generate")
def generate_skill(payload: SkillGenerateInput):
    try:
        from app.agents.skill_generator import generate_portal_skill_yaml
        yaml_draft = generate_portal_skill_yaml(
            portal_id=payload.portal_id,
            prompt_description=payload.prompt,
            provider=payload.model_provider
        )
        return {
            "success": True,
            "yaml_draft": yaml_draft
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/skills/{skill_id}")
def remove_skill(skill_id: str):
    delete_skill(skill_id)
    return {"success": True}

# --- REST File uploads pipeline ---
@app.post("/api/upload")
async def upload_document_or_media(file: UploadFile = File(...)):
    """Upload documents (CSV, JSON, XLSX) or media (images, videos) to local uploads directory."""
    try:
        file_id = uuid.uuid4().hex[:8]
        safe_filename = f"{file_id}_{file.filename}"
        dest_path = settings.UPLOADS_DIR / safe_filename
        
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        return {
            "success": True,
            "filename": file.filename,
            "saved_path": str(dest_path),
            "content_type": file.content_type
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File stream upload failed: {exc}")

# --- WebSocket Chat State Gateways ---
# Direct in-memory active session graphs database mapping
ACTIVE_SESSIONS_STATE: Dict[str, Dict[str, Any]] = {}

@app.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    session_id = None
    try:
        while True:
            # Await socket commands from frontend
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            
            # Extract standard payloads
            cmd_type = data.get("type", "chat")
            portal_id = data.get("portal_id", "")
            user_msg = data.get("text", "")
            session_id = data.get("session_id", str(uuid.uuid4()))
            model_provider = data.get("model_provider", settings.LLM_PROVIDER)
            
            # Load active portal configs
            portal = get_portal(portal_id)
            if not portal:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Active portal profile with ID '{portal_id}' is not loaded."
                }))
                continue
                
            # Initialize or recover the active session graph state
            if session_id not in ACTIVE_SESSIONS_STATE:
                ACTIVE_SESSIONS_STATE[session_id] = {
                    "messages": [],
                    "portal_id": portal_id,
                    "skills": list_skills(portal_id),
                    "plan": [],
                    "current_step_index": 0,
                    "variables": {},
                    "interrupt_payload": None,
                    "status_logs": [f"Session initialized for Portal: '{portal['name']}'."],
                    "model_provider": model_provider
                }
                save_session(session_id, portal_id, title=user_msg[:30] or "New Operations Run")
                
            session_state = ACTIVE_SESSIONS_STATE[session_id]
            session_state["model_provider"] = model_provider
            
            # Process command subtypes
            if cmd_type == "form_submit":
                # User returned parameter form submissions
                form_fields = data.get("variables", {})
                session_state["variables"].update(form_fields)
                session_state["interrupt_payload"] = None
                session_state["status_logs"].append("Resuming execution with provided input parameters.")
                
            elif cmd_type == "hitl_response":
                # User clicked Approve or Cancel inside HITL screen
                step_id = data.get("step_id")
                approved = data.get("approved", False)
                
                if approved:
                    session_state["variables"][f"_approved_{step_id}"] = True
                    session_state["status_logs"].append("Action explicitly approved by systems operator. Resuming flow.")
                else:
                    session_state["variables"][f"_cancelled_{step_id}"] = True
                    session_state["status_logs"].append("Action explicitly REJECTED by systems operator. Aborting workflow.")
                    
                session_state["interrupt_payload"] = None
                
            elif cmd_type == "chat":
                # Standard fresh incoming query
                session_state["messages"].append(HumanMessage(content=user_msg))
                
                # Check for bulk media file mappings in websocket inputs
                uploaded_file_path = data.get("file_path")
                if uploaded_file_path:
                    session_state["variables"]["_uploaded_bulk_file"] = uploaded_file_path
                    session_state["status_logs"].append(f"Mapped uploaded file attachment for processing: {os.path.basename(uploaded_file_path)}")

            # Stream intermediate planning states
            await websocket.send_text(json.dumps({
                "type": "logs",
                "logs": session_state["status_logs"]
            }))
            
            # Trigger/Resume LangGraph engine
            try:
                result_state = compiled_graph.invoke(session_state)
                # Store back current graph outcomes
                ACTIVE_SESSIONS_STATE[session_id] = result_state
                
                # Check if graph ended or paused on interrupt
                interrupt = result_state.get("interrupt_payload")
                
                if interrupt:
                    # Graph paused for HITL or dynamic form collection!
                    await websocket.send_text(json.dumps({
                        "type": "interrupt",
                        "payload": interrupt,
                        "logs": result_state["status_logs"],
                        "plan": result_state["plan"],
                        "current_step_index": result_state["current_step_index"]
                    }))
                else:
                    # Graph reached final step successfully
                    last_log = result_state["status_logs"][-1] if result_state["status_logs"] else "Execution complete."
                    await websocket.send_text(json.dumps({
                        "type": "completion",
                        "message": last_log,
                        "logs": result_state["status_logs"],
                        "plan": result_state["plan"],
                        "current_step_index": len(result_state["plan"])
                    }))
                    
            except Exception as graph_err:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Graph execution engine runtime error: {graph_err}"
                }))
                
    except WebSocketDisconnect:
        # Graceful cleanup of session state cache if needed
        pass
    except Exception as ws_err:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(ws_err)}))
        except Exception:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
