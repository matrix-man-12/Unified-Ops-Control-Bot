# Workspace Development History & Architectural Logs

This document serves as a persistent history log stored directly in the workspace under `/context/history_log.md`. It tracks all system modifications, Git events, architectural consensus points, and design revisions to ensure future AI agents or developer runs have 100% complete background context.

---

## Log Entry: 2026-05-23T22:50:00+05:30 (Initial Session)

### 1. Project Initialization & Git Setup
* **Action**: Initialized a new local Git repository in the workspace `e:\2026\May\AI_Bot`.
* **Action**: Created a root-level `.gitignore` file to isolate development artifacts from version control.
* **Commit hash**: `aa1417a` (Initial commit with gitignore).

### 2. Strategic Consensus & Design Revisions
The following choices were solidified based on user review of the technical implementation plan:

* **LLM Engine Compatibility**:
  * Unified adapter configured to route model calls dynamically.
  * Supports direct **Gemini API** calls for development via `langchain-google-genai` and environment keys.
  * Supports **any OpenAPI-compatible server** including local endpoints (Ollama, Llama.cpp, vLLM) and the user's custom corporate **Agent Builder API** using configurable Base URLs and credentials.

* **Secrets & Keys Management**:
  * API keys, tokens, and target portal configurations are treated as local environment items.
  * Stored in a root-level `.env` file (which is git-ignored for safety).
  * Persisted inside a local SQLite database file for easy per-session modification via the React UI.

* **Bulk Execution & File Upload Specs**:
  * Rich multi-format parser handles **CSV, JSON, and Excel (`.xlsx`)** bulk files via `openpyxl`.
  * Support for attaching multimedia objects (**videos and images**) which are streamed to a dedicated `/backend/uploads/` path.
  * Dynamically generated API client tools accept these local file paths as parameters.

* **Directory & Module Isolation Rules**:
  * Directory segregation strictly enforced:
    * `/frontend` (React + Vite + Vanilla CSS application)
    * `/backend` (FastAPI Python application with dynamic tool compilers and LangGraph workflows)
    * `/backend/venv` (Isolated Python virtual environment for offline-friendly local package management)
    * `/docs` (Public reference manuals and YAML skill creation tutorials)
    * `/context` (Persistent architecture plans and chronological development logs)

---
*End of log entry.*

## Log Entry: 2026-05-23T23:12:00+05:30 (Restructuring Session)

### 1. Folder Refactoring & Simplification
* **Action**: Stopped all background uvicorn and Vite servers to release file locks.
* **Action**: Merged the contents of `frontend/client/` directly into the `frontend/` root folder, removing the redundant `client/` folder.
* **Action**: Updated all workspace and artifact documentation files (`task.md`, `walkthrough.md`, `getting_started.md`) to point to `/frontend` instead of `/frontend/client`.

### 2. Services Relaunch
* **Action**: Successfully restarted the backend concurrent servers (`task-183`) and the restructured React dev server (`task-185`) in the background.
* **Result**: Vite successfully bound to `http://localhost:3000/` from the root of `/frontend` and uvicorn successfully bound to `http://127.0.0.1:8000`.

---
*End of log entry.*

## Log Entry: 2026-05-24T18:50:00+05:30 (Memory Integration & Visual Harness Session)

### 1. Backend Core Planning & Route Stabilization
* **Action**: Identified and resolved a critical Python f-string syntax crash in the dynamic planning prompt template inside [planner.py](file:///e:/2026/May/AI_Bot/backend/app/agents/planner.py) where unescaped braces caused `ValueError` exceptions and silently bypassed the LLM Planner.
* **Action**: Restructured the LLM Planner to compile the chronological preceding conversation history (`history_context`) and pass it dynamically inside the Gemini system prompt to support multi-turn intent resolution.
* **Action**: Update the loop quantity NLP parser `detect_loop_count` to inspect history to maintain loop states correctly across turns.
* **Action**: Fixed a LangGraph state machine conditional edge branch error in [graph.py](file:///e:/2026/May/AI_Bot/backend/app/agents/graph.py) that triggered a `KeyError: '__end__'` on interrupts by adding `"__end__": END` to the planner conditional edge routing directory.

### 2. Premium Visual HTML Documentation Suite
* **Action**: Designed and compiled a structured documentation manual suite in a dedicated `/docs/html/` subfolder, styled with a glassmorphism header, Inter typography, warm linen cream, and gold highlights:
  - [index.html](file:///e:/2026/May/AI_Bot/docs/html/index.html) (Landing dashboard of modules)
  - [getting_started.html](file:///e:/2026/May/AI_Bot/docs/html/getting_started.html) (FastAPI terminal runs and verification walks)
  - [skills_guide.html](file:///e:/2026/May/AI_Bot/docs/html/skills_guide.html) (YAML schemas reference and status polling specifications)
* **Action**: Mounted the `/docs/html` directory statically at `/documentation` in [main.py](file:///e:/2026/May/AI_Bot/backend/app/main.py) with the `html=True` flag enabled to automatically resolve `index.html`.
* **Action**: Configured the uvicorn execution subprocess inside the concurreny runner [run.py](file:///e:/2026/May/AI_Bot/backend/run.py) to enable `--reload` hot-reloading.

### 3. Visual UI Upgrades & Control Harness
* **Action**: Embedded a persistent "📚 System Docs Library" navigation footer card inside the sidebar configuration tab in [PortalSelector.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/PortalSelector.jsx).
* **Action**: Mounted a glassmorphic "📚 Help & Docs" shortcut button directly in the chat tab header inside [ChatWindow.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ChatWindow.jsx). All docs actions open securely in a new browser tab.
* **Action**: Replaced the empty chat feed with an interactive control harness welcome dashboard featuring layout guides and click-to-paste suggestion pills (e.g. `"Create 5 users"`).
* **Action**: Programmed a structural diagnostics log colorizer `parseLogDetails` inside [ChatWindow.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ChatWindow.jsx) to automatically parse text and format lines into colorful, mono-spaced planning, network, gateway, failure, and success states in both the Collapsible timeline and the Real-time shell console.

### 4. Git Commits
* **Commit `b2bb014`**: Added LLM conversation history planners, f-string fix, edge KeyError fix, and the raw HTML documentation.
* **Commit `6fa70b4`**: Added backend static documentation mounts, empty state suggestion harness dashboard, and custom diagnostics timeline colorizers.
* **Commit `9721994`**: Added `html=True` parameter fixes to FastAPI static mounts to serve default indices.

---
*End of log entry.*
