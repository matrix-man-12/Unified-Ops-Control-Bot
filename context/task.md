# Unified Portal Control Agent: Development Task List

This task list tracks the implementation steps for compiling the entire workspace. Items are marked as `[ ]` (pending), `[/]` (in progress), or `[x]` (completed).

---

## 1. Project Scaffolding & Git Tracking
- [x] Create root `.gitignore` file
- [x] Initialize empty Git repository and make initial commit
- [x] Set up persistent `/context` directory to house history, plans, and task trackers
- [x] Create `/docs` directory to hold system documentation

## 2. Backend Environment & Dependency Isolation
- [x] Initialize Python virtual environment (`venv`) inside `/backend/`
- [x] Write `/backend/requirements.txt` with offline-ready libraries
- [x] Write `/backend/app/config.py` supporting Gemini, local OpenAI endpoints, and your corporate Agent Builder

## 3. Mock Portal Server (For Local Testing)
- [x] Scaffold `/backend/mock_portal/main.py` (FastAPI CRUD for Users and Teams)
- [x] Generate standard OpenAPI `swagger.json` document for the mock portal
- [x] Add static route for media (image/video) assets simulation

## 4. Ingestion & Compiler Subsystems
- [x] Write `/backend/app/agents/api_compiler.py` to parse Swagger JSON/YAML and construct LangGraph-executable tools dynamically
- [x] Write `/backend/app/agents/skill_manager.py` to parse declarative workflow files (`project_skill.yaml`) and validate dependency trees

## 5. LangGraph Core Orchestration
- [x] Define dynamic schema `/backend/app/agents/state.py` with multi-step variables, active workflows, and HITL payloads
- [x] Implement the Planner Node `/backend/app/agents/planner.py`
- [x] Implement the Executor Node `/backend/app/agents/executor.py` with dynamic tool calls and file parsing pipelines (CSV/JSON/Excel)
- [x] Compile the LangGraph engine inside `/backend/app/agents/graph.py` with local SQLite checkpointers (`SqliteSaver`)

## 6. FastAPI Web & Websocket Service
- [x] Create SQLite schema `/backend/app/database.py` for persistent local portal and skill configurations
- [x] Implement main entrypoint `/backend/app/main.py` with real-time WebSocket connection pools and REST upload endpoints
- [x] Construct file storage pipeline to handle stream-saving multimedia attachments (videos, images) and bulk data files

## 7. Gorgeous React + Vite client
- [x] Scaffold `/frontend/` Vite React application (non-interactive mode setup)
- [x] Establish corporate visual design system in `/frontend/src/index.css` (Glassmorphism, curated HSL variables, fluid typography, sleek dark mode, scroll animations)
- [x] Build `/frontend/src/components/PortalSelector.jsx` (Switch active portal, configure credentials, upload Swagger/Skills)
- [x] Build `/frontend/src/components/ChatWindow.jsx` with WebSocket event processing and real-time execution logger
- [x] Build `/frontend/src/components/DynamicForm.jsx` to render parameters collected via LLM JSON schemas
- [x] Build `/frontend/src/components/ConfirmationCard.jsx` to display interactive Human-in-the-Loop approval requests
- [x] Build `/frontend/src/components/FileUploader.jsx` for CSV, JSON, Excel, and video/image uploads with parsing visual previews
- [x] Connect full system loop in `/frontend/src/App.jsx`

## 8. Integration Verification & Documentation
- [x] Write unit tests for compilers in `/backend/tests/`
- [x] Verify single API tool generation, automated execution, and HITL approval interrupts
- [x] Verify bulk upload parsing and automated loop/bulk execution logic
- [x] Create system documentation in `/docs/`
