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
