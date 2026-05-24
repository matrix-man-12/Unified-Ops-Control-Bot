# Getting Started: Operational Agent Dashboard

This guide describes how to run and test the Unified Portal Control Agent system locally. Follow these steps to spin up the FastAPI servers, compile the React workspace, and execute your first operational workflow with manual approvals.

---

## 1. Prerequisites

Ensure you have the following installed locally:
* **Python 3.10+** (tested on Python 3.11)
* **Node.js 18+** & **npm**

---

## 2. Booting the Backend Subsystems

We have integrated an isolated Python virtual environment (`venv`) and a concurrent runner `run.py` to make execution trivial.

1. Open a terminal and navigate to the `/backend` folder:
   ```powershell
   cd backend
   ```
2. Activate the virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Boot both the **Mock Portal Server** (port 8081) and the **Main Agent WebSocket Server** (port 8000) concurrently:
   ```powershell
   python run.py
   ```
   * *The Mock Portal serves a local CRUD API mimicking your corporate portals at `http://127.0.0.1:8081`.*
   * *The main orchestrator serves WebSocket and REST bridges at `http://127.0.0.1:8000`.*

---

## 3. Booting the React Client Dashboard

1. Open a new terminal window and navigate to the frontend workspace:
   ```powershell
   cd frontend
   ```
2. Install local npm dependencies (React, ReactDOM, Lucide React, Vite):
   ```powershell
   npm install
   ```
3. Boot the Vite hot-reloading development server:
   ```powershell
   npm run dev
   ```
4. Open your browser and navigate to the dashboard:
   **[http://localhost:3000](http://localhost:3000)**

---

## 4. Step-by-Step Integration Verification Walkthrough

Once both applications are running, execute the following workflow to test the dynamic compilers, compilers, forms, and Human-in-the-Loop gates:

### Step A: Configure the Portal Connection
1. In the left panel of the browser dashboard, click **"Add Portal"**.
2. Fill out the form with the following details:
   * **Portal Nickname ID**: `mock-admin`
   * **Display Title**: `Corporate Admin Portal`
   * **Base Target API URL**: `http://127.0.0.1:8081`
   * **Authentication Headers**:
     * Key: `Authorization`
     * Value: `Bearer mock-secret-bearer-key`
3. Retrieve the raw OpenAPI Swagger document from the running Mock Portal. In a new tab, open:
   `http://127.0.0.1:8081/openapi.json`
4. Copy the entire raw JSON text and paste it into the **OpenAPI Swagger Spec** textarea.
5. Click **"Register"**.

---

### Step B: Teach the Portal a Skill Workflow
1. Select the newly registered `Corporate Admin Portal` in your sidebar list.
2. Under "Uploaded Portal Skills", click **"Teach Portal a Skill (.yaml)"**.
3. Choose or drag the sample skill YAML template below. Save this text locally as `create_user.yaml` before uploading:
   ```yaml
   id: mock_create_user
   name: "Corporate User Enlistment"
   description: "Guideline steps to create a new user profile on the Admin dashboard."
   version: "1.0.0"
   steps:
     - step: 1
       id: gather_inputs
       action_type: "collect_input"
       input_fields:
         - name: "email"
           type: "string"
           required: true
           description: "User corporate email"
         - name: "username"
           type: "string"
           required: true
           description: "Unique account username"
         - name: "role"
           type: "string"
           required: true
           options: ["Administrator", "Developer", "Guest"]
           description: "Assigned access role"
     - step: 2
       id: execute_creation
       action_type: "api_call"
       tool_name: "create_user"
       inputs:
         email: "{{email}}"
         username: "{{username}}"
         role: "{{role}}"
         team_name: "Engineering"
       requires_approval: true
   ```
4. Verify that the skill registers successfully and displays in the list!

---

### Step C: Execute Chat Operation & HITL Approvals
1. In the chat input, type: **`Execute user enlistment workflow`** and hit Send.
2. The Planner node will dynamically match your request to the `mock_create_user` skill and compile the 2-step plan, displaying it in the right checklist tracker.
3. The Executor node will check Step 1 (`gather_inputs`). Since email, username, and role are not present in variables, it halts execution and **opens a sleek form card** directly in the chat panel!
4. Fill in the form fields (e.g. `operator-1@company.com`, `ops_lead`, select `Administrator` role) and click **"Submit Details"**.
5. The graph resumes, saves variables, and starts Step 2 (`execute_creation`).
6. Because `requires_approval` is set to `true`, execution pauses again. **A glowing Security Authorization Card slides into view**, detailing:
   * Target URL base and authorization headers validation.
   * JSON payload inputs mapping.
7. Click **"Authorize & Execute"**.
8. The graph resumes, triggers the live REST request to `http://127.0.0.1:8081/users`, and receives the confirmation response.
9. Watch the stepper marks go **completed (green check)**, and the agent post the final successful creation response message in chat!

---

## 5. Advanced: Batch & Loop Operations

Our platform natively supports dynamic bulk iteration logic (e.g. executing workflows multiple times in parallel/sequential runs).

### Step D: Triggering a Bulk Loop Run
1. In the chat prompt, type: **`Create 5 users`** or **`Batch register 3 users: operator-1@company.com and operator-2@company.com`**.
2. Notice that the **Dynamic LLM Planner** is instantly invoked (never bypassed!). It parses your intent, extracts quantities (e.g., 5), pre-populates variables that were in the query (like emails), and builds a loop-configured stepper checklist marked with `🔄 LOOP MODE (5 Items)`.
3. **Unified Loop Form**: Step 1 (`gather_inputs`) halts and displays a paginated card slider directly inside the chat workspace letting you enter details for "Item 1 of 5", "Item 2 of 5", etc. completely on a single screen!
4. **One-Click Batch Authorization**: Step 2 (`execute_creation`) halts and displays a unified authorization grid listing the target parameters of all 5 iterations. Review the batch variables and click **"Authorize Batch Run"** to approve all 5 API mutations in a single operation!
5. **Real-time Metrics & Fault Tolerance**:
   * During execution, a dynamic percentage bar shows progress (e.g. `Processing Loop Index... 3 of 5 (60%)`) in real time.
   * If any specific user creation API fails (e.g. user 3 is duplicates), the executor automatically registers the failure in details, continues the loop to create subsequent users (4 and 5), and displays a detailed success/error breakdown tally badge upon step completion!
   * Expand the **⚡ Agent Mind Timeline** to inspect the real-time granular cognitive thought logs of the running agent.

