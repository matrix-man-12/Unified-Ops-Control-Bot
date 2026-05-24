# Generic Dynamic LLM Planner & Executor with Robust Batch/Loop Execution

This document details the architectural design and implementation plan to add native support for **generic dynamic loop planning, parameter extraction, and batch execution**. This enables users to perform bulk actions (e.g. "Create 5 users") dynamically, without hardcoding any portal logic. It details the structured LLM input/output formats, loop schemas, human-in-the-loop batch authorization, and UI scrollability and thought-process updates.

---

## User Review Required

We are introducing a powerful, fully generic dynamic orchestration layer. Please review the proposed schemas, designs, and interactive flows:

> [!IMPORTANT]
> **Loop Execution Mode**: When a user request implies bulk or repeat operations (e.g. *"Create 5 users"*), the system will dynamically compile it into loop execution steps. It supports both predefined YAML skills and custom dynamic API routes.
>
> **Dynamic Parameter Extraction**: The Planner LLM will interpret user queries and attempt to extract any inline values (e.g., names, emails) into a pre-populated parameter list.
> 
> **Unified Bulk Input Collection**: If details for any items in a loop are missing, the UI will display a premium, scrollable multi-card input container letting the user specify details for all loop items in a single submit operation.
>
> **One-Click Batch Authorization**: To prevent approval fatigue, write actions in loop mode will prompt the operator with a single unified confirmation screen showing all parameters of the batch execution before run.
> 
> **Chat Scrollability & Thought-Process Tracking**: Fixes the non-scrollable chat viewport height bugs. Displays glowing progress percentages for active loops, and expands the collapsible "Agent Mind Timeline" to expose the granular real-time cognitive reasoning of the agent.

---

## Technical Specifications & LLM Schemas

### 1. Loop Step Data Schema (`AgentState` & `ExecutionStep`)
To support single-item and loop-based execution dynamically, the `ExecutionStep` model inside [state.py](file:///e:/2026/May/AI_Bot/backend/app/agents/state.py) will be extended with loop-tracking fields:

```python
class ExecutionStep(TypedDict):
    step: int
    id: str
    description: str
    action_type: str            # api_call, collect_input, manual_instruction
    
    # Executable properties
    tool_name: Optional[str]
    inputs: Optional[Dict[str, Any]]
    requires_approval: Optional[bool]
    
    # NEW: Loop Orchestration Fields
    execution_mode: str         # "single" or "loop"
    loop_count: int             # Number of items to process (e.g., 5)
    current_loop_index: int     # Current active iteration index (0-indexed)
    parameter_list: List[Dict[str, Any]] # Array of parameters for each loop item
    
    # Input schemas
    input_fields: Optional[List[Dict[str, Any]]]
    message: Optional[str]
    status: str                 # pending, running, completed, failed, interrupted
```

### 2. Planner LLM Output Schema & System Prompt
When user queries contain quantities or lists (e.g., *"Create 5 users"*, *"Add 3 items"*), the Planner LLM will be instructed to structure the plan with loop steps.

#### Output JSON Schema expected from LLM:
```json
{
  "steps": [
    {
      "step": 1,
      "id": "gather_users_details",
      "description": "Gather email and role inputs for 5 users",
      "action_type": "collect_input",
      "execution_mode": "loop",
      "loop_count": 5,
      "input_fields": [
        { "name": "email", "type": "string", "required": true, "description": "Corporate email address" },
        { "name": "role", "type": "string", "required": true, "description": "System access role" }
      ],
      "parameter_list": []
    },
    {
      "step": 2,
      "id": "create_users_loop",
      "description": "Call API to create 5 users in a batch",
      "action_type": "api_call",
      "tool_name": "create_user",
      "execution_mode": "loop",
      "loop_count": 5,
      "inputs": {
        "email": "{{email}}",
        "role": "{{role}}"
      },
      "requires_approval": true,
      "parameter_list": []
    }
  ]
}
```

---

## Proposed Changes

### 1. Backend Core & State Machine

#### [MODIFY] [state.py](file:///e:/2026/May/AI_Bot/backend/app/agents/state.py)
* Add `execution_mode`, `loop_count`, `current_loop_index`, and `parameter_list` properties to `ExecutionStep` TypedDict.
* Add generic `bulk_data` list tracker support to store compiled bulk outputs.

#### [MODIFY] [planner.py](file:///e:/2026/May/AI_Bot/backend/app/agents/planner.py)
* Enhance `plan_node` to parse the user's conversational text for bulk keywords (e.g., *"create 5..."*, *"add 3..."*, *"register 10..."*).
* Update LLM planning fallback prompts to enforce structured loop definitions when bulk request is detected.
* Instruct the LLM to pre-extract variables from the user's prompt (e.g. *"Create 2 users: user1@example.com (admin) and user2@example.com (user)"*) into the step's `parameter_list`.
* Map pre-compiled matching YAML skill definitions into loop steps automatically if a loop count is detected.

#### [MODIFY] [executor.py](file:///e:/2026/May/AI_Bot/backend/app/agents/executor.py)
* Rewrite `execute_node` to natively handle `execution_mode: "loop"` steps.
* **Loop Parameter Collection (`collect_input`)**: 
  - If `parameter_list` is empty or its length is less than `loop_count`, halt execution and trigger a `form_request` interrupt containing a loop flag.
  - The UI will collect the values for *all* iterations in a single unified dashboard card.
* **Loop Write Authorization (`api_call` + `requires_approval`)**:
  - Halt execution and trigger a `hitl_request` payload. Instead of single confirmation, pass all items inside `parameter_list` for a single-click batch approval.
* **Iterative Run Action**:
  - Run a synchronous sequence over `parameter_list`.
  - Dynamically set `step["current_loop_index"] = index` at each run.
  - Push real-time step indices and cognitive thought logs (e.g. *"Loop 2/5 (40%): Creating user bob@test.com..."*) via WebSocket status streams.
  - Keep REST execution fully generic by looking up routes dynamically from Swagger definitions.

---

### 2. Frontend Interface & UI Controls

#### [MODIFY] [ChatWindow.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ChatWindow.jsx)
* **Chat Container Heights & Scrollability Fix**: 
  - Remove `height: '100%'` constraints from view tabs. Enable nested flex shrink (`min-height: 0`) and verify scroll container heights dynamically.
  - Fix the conversation auto-scroll to snap smoothly to the absolute bottom when new messages arrive.
* **Step Progress Checklist Badges**:
  - If a step is in loop mode and in progress, render a glowing progress percentage bar: `Processing: 3 of 5 (60%)` inside an alabaster-gold badge.
* **Collapsible Agent Mind Timeline**:
  - Allow fully expanding the logs panel to render all chronological thought lines, rather than capping at the last 5.

#### [MODIFY] [DynamicForm.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/DynamicForm.jsx)
* Support `execution_mode: "loop"` interrupt forms.
* When loop mode is active, render a beautiful card-slider or vertical tabbed sheet: "Item 1 of N", "Item 2 of N", etc. This allows entering details for all loop items collectively on a single screen and submitting once.

#### [MODIFY] [ConfirmationCard.jsx](file:///e:/2026/May/AI_Bot/frontend/src/components/ConfirmationCard.jsx)
* Support loop mode batch visualizations.
* Render parameters of all loop items in an elegant data grid, allowing the system operator to review the entire bulk execution before hitting **Authorize Action**.

---

## Verification Plan

### Automated / Browser-based Testing
1. **Chat UI Scroll Test**:
   * Flood the chat with numerous messages. Confirm the conversation panel scrolls naturally and snaps to bottom without overflowing or freezing page layout boundaries.
2. **Loop Execution Test**:
   * Query the chat: *"Create 5 users"*.
   * Verify that the Execution Plan immediately compiles 2 steps, both marked as `LOOP MODE` with progress indicators `0 of 5`.
   * Verify that the UI displays a beautiful dynamic form representing all 5 users.
   * Fill in the data for all 5 users, hit Submit.
   * Verify the Confirmation Card displays all 5 users in a clean grid for single-click batch approval.
   * Click **Approve**.
   * Observe the active plan stepper and Agent Mind Timeline stream live updates (e.g. *"Loop 1/5: User 'user1' created"* -> *"Loop 2/5..."*).
   * Confirm the mock database lists all 5 users successfully.

---

## Open Questions

> [!NOTE]
> **Q1: Failure Strategy inside Loop Step Sequence**
> If user 3 of 5 fails to compile or returns an API error, should the loop executor halt entirely (aborted plan) or skip/ignore the failure and proceed with the remaining users (4/5 and 5/5)? We propose a **Safe-Halt** policy as default, but we can make this configurable.
