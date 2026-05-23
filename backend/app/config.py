import os
from pathlib import Path
from dotenv import load_dotenv

# Base Directory of the Project
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Load local environment variables from root and backend folders
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

class Settings:
    # Server Configurations
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    
    # Uploads & Temp Storage
    UPLOADS_DIR: Path = BACKEND_DIR / "uploads"
    TEMP_DIR: Path = BACKEND_DIR / "app" / "temp"
    STORAGE_DIR: Path = BACKEND_DIR / "app" / "storage"
    
    # Database Settings
    SQLITE_DB_PATH: Path = BACKEND_DIR / "app" / "storage" / "portal_agent.db"
    
    # Active LLM Configuration
    # Options: "gemini", "openai", "agent_builder"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini").lower()
    
    # API Credentials & Endpoints
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL_NAME: str = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")
    
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_API_BASE: str = os.getenv("OPENAI_API_BASE", "http://localhost:11434/v1") # Default local Ollama
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "llama3")
    
    # Corporate Agent Builder Configuration
    AGENT_BUILDER_API_KEY: str = os.getenv("AGENT_BUILDER_API_KEY", "")
    AGENT_BUILDER_BASE_URL: str = os.getenv("AGENT_BUILDER_BASE_URL", "")
    AGENT_BUILDER_MODEL: str = os.getenv("AGENT_BUILDER_MODEL", "agent-builder-model")

# Instantiate settings
settings = Settings()

# Ensure critical application directories exist dynamically
settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
