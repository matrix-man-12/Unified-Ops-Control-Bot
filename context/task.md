# Generic Dynamic Loop Planning & Batch Execution Checklist

- `[ ]` 1. Backend Loop State & Logic
  - `[ ]` Extend `ExecutionStep` schema in `state.py` with loop attributes (`execution_mode`, `loop_count`, `current_loop_index`, `parameter_list`).
  - `[ ]` Update `planner.py` to identify loop counts and quantities in queries and output the new Loop Plan JSON Schema.
  - `[ ]` Rewrite `execute_node` in `executor.py` to support `execution_mode == "loop"`.
  - `[ ]` Implement batch input collection interrupt in executor (`action_type == "collect_input"`).
  - `[ ]` Implement batch write authorization interrupt in executor (`action_type == "api_call"` + `requires_approval`).
  - `[ ]` Implement iterative execution sequence in executor with dynamic websocket progress metrics.

- `[ ]` 2. Frontend Chat Window Scrollability & Indicators
  - `[ ]` Remove hardcoded heights in active chat view components in `ChatWindow.jsx` and `App.jsx` to restore absolute container scrollability.
  - `[ ]` Fix the chat feed scroll auto-snapping to follow real-time logs.
  - `[ ]` Add glowing `LOOP MODE` step badges and progress percentage indicators inside the Execution Plan tab checklist.
  - `[ ]` Expose all chronological reasoning details in the Collapsible Agent Mind Timeline logs window.

- `[ ]` 3. Interactive Multi-Card Loop Overlays
  - `[ ]` Update `DynamicForm.jsx` to render beautiful card groups or sliders for loop parameter collection when `execution_mode === "loop"`.
  - `[ ]` Update `ConfirmationCard.jsx` to display a premium data grid listing details for all batch iterations for one-click authorization.
