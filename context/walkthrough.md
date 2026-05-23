# Systems Walkthrough: Unified Portal Control Agent

This document summarizes the complete implementation, scaffolding, and verification steps executed for the **Unified Portal Control Agent**. The codebase is fully isolated, modular, and ready for deployment in your corporate offline environment.

---

## 1. Summary of Changes Made

We have structured the project into highly independent, clean subdirectories inside the workspace `e:\2026\May\AI_Bot`:

### A. Root Scaffolding
* **[NEW] [.gitignore](file:///e:/2026/May/AI_Bot/.gitignore)**: Prevents local virtual environments, node modules, SQLite database files, and local `.env` secrets from polluting version control.
* **[NEW] [Git Repository](file:///e:/2026/May/AI_Bot/.git/)**: Initialized and tracked with the initial `.gitignore` commit.

### B. Isolated Backend Services (`/backend`)
* **[NEW] [requirements.txt](file:///e:/2026/May/AI_Bot/backend/requirements.txt)**: Tailored offline-ready libraries (FastAPI, Uvicorn, LangGraph, LangChain, Pydantic, HTTPX, openpyxl, python-dotenv) with flexible constraints compatible with modern **Python 3.13**.
* **[NEW] [venv (Virtual Environment)](file:///e:/2026/May/AI_Bot/backend/venv/)**: Sandboxed Python package directory.
* **[NEW] [run.py](file:///e:/2026/May/AI_Bot/backend/run.py)**: Multi-process runner that launches the Main Agent Server and the Mock Portal simultaneously, managing clean shutdown hooks.
* **[NEW] [app/config.py](file:///e:/2026/May/AI_Bot/backend/app/config.py)**: Environment configurations supporting Gemini, generic local OpenAI models (Ollama), and your corporate **Agent Builder API** via custom key/URL bindings.
* **[NEW] [app/database.py](file:///e:/2026/May/AI_Bot/backend/app/database.py)**: Direct SQLite manager hosting schemas and helpers for Portals (base URLs, Swagger specs, secrets), Skills (workflows YAML), and session history.
* **[NEW] [app/main.py](file:///e:/2026/May/AI_Bot/backend/app/main.py)**: FastAPI gateway hosting upload REST routes and the `/ws/chat` WebSocket connection loop with dynamic interrupt handlers.

### C. Ingestion, Compiler, & LangGraph Subsystems (`/backend/app/agents`)
* **[NEW] [state.py](file:///e:/2026/May/AI_Bot/backend/app/agents/state.py)**: Defines the structured `AgentState` mapping step plans, active values, and HITL interrupt objects.
* **[NEW] [api_compiler.py](file:///e:/2026/May/AI_Bot/backend/app/agents/api_compiler.py)**: Parses Swagger specifications and dynamically compiles LangChain `StructuredTool` callers to perform network actions on target portals.
* **[NEW] [skill_manager.py](file:///e:/2026/May/AI_Bot/backend/app/agents/skill_manager.py)**: YAML skill parser validating workflows structures and mapping sequential inputs binding scopes.
* **[NEW] [planner.py](file:///e:/2026/May/AI_Bot/backend/app/agents/planner.py)**: Hybrid plan generator matching pre-defined YAML skills deterministically and compiling custom Swagger steps via LLM.
* **[NEW] [executor.py](file:///e:/2026/May/AI_Bot/backend/app/agents/executor.py)**: Actions loop executing dynamic inputs form pause requests, spreadsheet batch mapping (Excel, CSV, JSON), and HITL authorization pauses.
* **[NEW] [graph.py](file:///e:/2026/May/AI_Bot/backend/app/agents/graph.py)**: Compiled LangGraph StateGraph orchestrator.

### D. Offline Mock Portal Server (`/backend/mock_portal`)
* **[NEW] [mock_portal/main.py](file:///e:/2026/May/AI_Bot/backend/mock_portal/main.py)**: A simulated corporate portal hosting user creation CRUD, bulk uploads, file attachment endpoints, and exposing a dynamic `/openapi.json` schema on port `8081` for end-to-end local testing.

### E. Gorgeous Glassmorphic React Client (`/frontend`)
* **[NEW] [package.json](file:///e:/2026/May/AI_Bot/frontend/package.json)** & **[vite.config.js](file:///e:/2026/May/AI_Bot/frontend/vite.config.js)**: Vite dev configs running on port `3000` with automated `/api/*` proxies routing requests directly to the FastAPI server.
* **[NEW] [index.css](file:///e:/2026/May/AI_Bot/frontend/src/index.css)**: Obsidian space theme utilizing smooth transitions, neon glows, glassmorphic cards, custom technical scroll bars, and Outfit/Inter google typography tokens.
* **[NEW] [App.jsx](file:///e:/2026/May/AI_Bot/frontend/src/App.jsx)**: Dashboard workspace connecting side portal config bars, chat conversation consoles, and active form overlay components.
* **[NEW] [PortalSelector.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/PortalSelector.jsx)**: Panel to register portals, define custom dynamic HTTP headers, view/upload Swagger docs, and teach YAML skills.
* **[NEW] [ChatWindow.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ChatWindow.jsx)**: Custom message logger, horizontal stepper showing plan steps (pending, running, completed, or failed), and terminal console displaying technical execution scripts in real-time.
* **[NEW] [DynamicForm.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/DynamicForm.jsx)**: Dynamically renders inputs forms requested by the agent state.
* **[NEW] [ConfirmationCard.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ConfirmationCard.jsx)**: Glowing Human-in-the-Loop authorization card, warning operators of mutating requests and listing raw payloads.
* **[NEW] [FileUploader.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/FileUploader.jsx)**: Drag-and-drop file upload engine linking CSV, JSON, Excel spreadsheet documents, and video/image attachments onto the server path.

### F. Systems Documentation (`/docs`)
* **[NEW] [getting_started.md](file:///e:/2026/May/AI_Bot/docs/getting_started.md)**: Easy system bootstrap guidelines and verification walkthrough.
* **[NEW] [skills_guide.md](file:///e:/2026/May/AI_Bot/docs/skills_guide.md)**: Extensive developer handbook on constructing YAML Project Skills.

---

## 2. Technical Verification Summary

We established two automated and manual verification layers to prove correctness:

### A. Automated Unit Tests
* **[NEW] [tests/test_compilers.py](file:///e:/2026/May/AI_Bot/backend/tests/test_compilers.py)**:
  * Verifies recursive Swagger Reference resolver (`$ref` mapping).
  * Verifies API parser extracts parameters correctly and yields StructuredTools.
  * Verifies Skill manager parses and validates declarative YAML fields schemas.
  * Verifies dynamic double-curly parameters interpolation.

### B. Manual Walkthrough Checklist
We mapped a step-by-step manual validation pipeline (detailed in [docs/getting_started.md](file:///e:/2026/May/AI_Bot/docs/getting_started.md)) allowing you to register the mock portal, teach it a sample user creation skill, fill out a dynamic parameter form in the client UI, approve the post request on the HITL card, and confirm that the API successfully creates the user in the mock database!
