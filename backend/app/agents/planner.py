import json
import re
from typing import Dict, Any, List, Optional
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.state import AgentState, ExecutionStep

def get_llm(provider: str) -> Any:
    """Load the designated LLM provider dynamically based on config settings."""
    prov = provider.lower() if provider else settings.LLM_PROVIDER
    if prov == "gemini":
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL_NAME,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.0
        )
    elif prov == "agent_builder":
        return ChatOpenAI(
            model=settings.AGENT_BUILDER_MODEL,
            openai_api_key=settings.AGENT_BUILDER_API_KEY,
            openai_api_base=settings.AGENT_BUILDER_BASE_URL,
            temperature=0.0
        )
    else:
        return ChatOpenAI(
            model=settings.OPENAI_MODEL_NAME,
            openai_api_key=settings.OPENAI_API_KEY or "local-key",
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.0
        )

def find_matching_skill(user_query: str, skills: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Determine if a registered YAML skill matches the user's conversational intent."""
    query = user_query.lower()
    for skill in skills:
        yaml_content = yaml_safe_load(skill.get("yaml_content", ""))
        if not yaml_content:
            continue
        # Check name and description matches
        name = yaml_content.get("name", "").lower()
        desc = yaml_content.get("description", "").lower()
        skill_id = yaml_content.get("id", "").lower()
        
        if skill_id in query or name in query or any(word in query and len(word) > 3 for word in name.split()):
            return yaml_content
    return None

def yaml_safe_load(content: str) -> Optional[Dict[str, Any]]:
    """Graceful wrapper around YAML parsing."""
    import yaml
    try:
        return yaml.safe_load(content)
    except Exception:
        return None

def plan_node(state: AgentState) -> Dict[str, Any]:
    """
    Planner Node: Analyzes intent, binds skills or compiles customized tools sequences,
    and updates the state plan.
    """
    messages = state.get("messages", [])
    user_query = messages[-1].content if messages else ""
    skills = state.get("skills", [])
    portal_id = state.get("portal_id", "")
    provider = state.get("model_provider", settings.LLM_PROVIDER)
    
    logs = list(state.get("status_logs", []))
    logs.append(f"Analyzing operational request: '{user_query}'...")
    
    # 1. Check if a pre-compiled YAML skill matches
    matched_skill = find_matching_skill(user_query, skills)
    if matched_skill:
        logs.append(f"Determined Skill Match: '{matched_skill.get('name')}' (ID: {matched_skill.get('id')})")
        plan_steps = []
        for step in matched_skill.get("steps", []):
            plan_steps.append({
                "step": step.get("step"),
                "id": step.get("id"),
                "description": step.get("description", ""),
                "action_type": step.get("action_type", "api_call"),
                "tool_name": step.get("tool_name"),
                "inputs": step.get("inputs"),
                "requires_approval": step.get("requires_approval", False) or step.get("requires_confirmation", False),
                "input_fields": step.get("input_fields"),
                "message": step.get("message"),
                "status": "pending"
            })
            
        # Inspect user query for inline parameters (e.g. extraction of username, email)
        initial_vars = {}
        # Simple extraction helper
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', user_query)
        if email_match:
            initial_vars["email"] = email_match.group(0)
            initial_vars["user_email"] = email_match.group(0)
            
        logs.append(f"Successfully compiled plan with {len(plan_steps)} sequential actions.")
        return {
            "plan": plan_steps,
            "current_step_index": 0,
            "variables": initial_vars,
            "status_logs": logs
        }
        
    # 2. Dynamic planning fallback using LLM
    logs.append("No pre-defined skill matching. Initializing dynamic Swagger tools compiler...")
    
    # Retrieve dynamic tools listing for context
    # Note: We pass raw Swagger schemas or simple tool signatures to the prompt
    # to avoid context overflow on smaller local models.
    available_tools = []
    # Dynamic tool listing mock compilation would happen here; we pass metadata
    # for compiling target schema models
    
    prompt = f"""
    You are an expert systems operator and planner. The user wants to achieve: "{user_query}"
    
    Your task is to compile a sequential list of steps using available API tools to achieve the goal.
    Since this is a custom plan, output a JSON array representing the steps. Each step must have:
    - step: integer sequence (1, 2, 3...)
    - id: unique step snake_case ID
    - description: what this step is doing
    - action_type: always "api_call"
    - tool_name: the name of the operation (e.g., "create_user" or "get_team_by_name")
    - inputs: input key-value binds
    - requires_approval: true (if it's a POST, PUT, DELETE write operation)
    
    If the user has provided specific parameters (like emails, roles), capture them in the 'inputs' dictionary.
    If some required arguments are missing, don't worry, the executor node will automatically ask the user for them.
    
    Response format must be a raw JSON array block inside code fences:
    ```json
    [ ... ]
    ```
    """
    
    try:
        llm = get_llm(provider)
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content
        
        # Regex extract JSON array
        json_match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
        if json_match:
            plan_steps = json.loads(json_match.group(0))
            # Format and inject pending status
            for idx, s in enumerate(plan_steps):
                s["step"] = idx + 1
                s["status"] = "pending"
                if "requires_approval" not in s:
                    s["requires_approval"] = True # Safe default
            
            logs.append(f"Compiled dynamic execution plan with {len(plan_steps)} API steps.")
            return {
                "plan": plan_steps,
                "current_step_index": 0,
                "status_logs": logs
            }
        else:
            raise ValueError("LLM response did not contain a valid JSON plan array.")
    except Exception as exc:
        logs.append(f"Dynamic planner compilation failed: {exc}. Creating fallback single action step.")
        # Fallback placeholder single action
        fallback_step = {
            "step": 1,
            "id": "operator_fallback",
            "description": f"Perform manual review of: {user_query}",
            "action_type": "manual_instruction",
            "message": f"Review and resolve request manually: {user_query}",
            "status": "pending"
        }
        return {
            "plan": [fallback_step],
            "current_step_index": 0,
            "status_logs": logs
        }
