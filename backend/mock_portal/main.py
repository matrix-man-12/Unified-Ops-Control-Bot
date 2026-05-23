from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
import uvicorn
import uuid

app = FastAPI(
    title="Corporate Operations Admin Portal",
    description="Operational API for managing corporate staff, teams, and rich media assets.",
    version="1.0.0"
)

# In-memory database simulation
TEAMS_DB: Dict[str, Dict[str, Any]] = {
    "Engineering": {"id": "eng-101", "name": "Engineering", "description": "Core software engineers"},
    "Operations": {"id": "ops-202", "name": "Operations", "description": "IT and systems operations"}
}

USERS_DB: Dict[str, Dict[str, Any]] = {}

# Pydantic Schemas
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    username: str
    role: str
    team_name: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    team_name: str
    status: str = "Active"

# Token Mock Authentication Check
def verify_auth(authorization: Optional[str] = Header(None)) -> None:
    if authorization is None:
        raise HTTPException(status_code=401, detail="Unauthorized: No Bearer Token Provided")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Token Format")

# Teams Endpoints
@app.get("/teams", response_model=List[Dict[str, Any]], tags=["Teams"])
def list_teams():
    return list(TEAMS_DB.values())

@app.get("/teams/{name}", tags=["Teams"])
def get_team_by_name(name: str):
    if name in TEAMS_DB:
        return TEAMS_DB[name]
    raise HTTPException(status_code=404, detail=f"Team '{name}' not found")

@app.post("/teams", tags=["Teams"])
def create_team(team: TeamCreate, authorization: Optional[str] = Header(None)):
    verify_auth(authorization)
    if team.name in TEAMS_DB:
        raise HTTPException(status_code=400, detail="Team already exists")
    new_team = {
        "id": f"team-{uuid.uuid4().hex[:6]}",
        "name": team.name,
        "description": team.description
    }
    TEAMS_DB[team.name] = new_team
    return new_team

# Users Endpoints
@app.get("/users", response_model=List[UserResponse], tags=["Users"])
def list_users():
    return list(USERS_DB.values())

@app.post("/users", response_model=UserResponse, status_code=210, tags=["Users"])
def create_user(user: UserCreate, authorization: Optional[str] = Header(None)):
    verify_auth(authorization)
    # Check if team exists
    if user.team_name not in TEAMS_DB:
        raise HTTPException(status_code=400, detail=f"Target team '{user.team_name}' does not exist")
    
    # Check duplicate email
    for u in USERS_DB.values():
        if u["email"] == user.email:
            raise HTTPException(status_code=400, detail="User with this email already exists")
            
    user_id = f"usr-{uuid.uuid4().hex[:6]}"
    new_user = {
        "id": user_id,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "team_name": user.team_name,
        "status": "Active"
    }
    USERS_DB[user_id] = new_user
    return new_user

@app.post("/users/bulk", response_model=List[UserResponse], tags=["Users"])
def create_users_bulk(users: List[UserCreate], authorization: Optional[str] = Header(None)):
    verify_auth(authorization)
    created_users = []
    # Begin bulk processing transaction mock
    for user in users:
        if user.team_name not in TEAMS_DB:
            raise HTTPException(status_code=400, detail=f"Bulk creation failed: Team '{user.team_name}' does not exist")
        
        user_id = f"usr-{uuid.uuid4().hex[:6]}"
        new_user = {
            "id": user_id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "team_name": user.team_name,
            "status": "Active"
        }
        USERS_DB[user_id] = new_user
        created_users.append(new_user)
    return created_users

# Dynamic Asset / media upload
@app.post("/upload-asset", tags=["Assets"])
def upload_media_asset(
    userId: str = Form(...),
    assetType: str = Form(...),  # e.g., "profile_photo", "training_video"
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    verify_auth(authorization)
    # Mock file save confirmation
    file_size = len(file.file.read())
    return {
        "success": True,
        "userId": userId,
        "assetType": assetType,
        "filename": file.filename,
        "size_bytes": file_size,
        "content_type": file.content_type,
        "asset_url": f"http://mockportal/assets/{uuid.uuid4().hex[:8]}_{file.filename}"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8081)
