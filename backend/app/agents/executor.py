from typing import Dict, Any, List, Optional
from langchain_core.messages import AIMessage
from app.agents.state import AgentState, ExecutionStep
from app.agents.api_compiler import make_http_call, compile_openapi_tools
from app.agents.skill_manager import interpolate_inputs
from app.database import get_portal

def parse_bulk_file(file_path: str) -> List[Dict[str, Any]]:
    """Parse bulk data files (CSV, JSON, XLSX) using local helpers."""
    import csv
    import json
    from pathlib import Path
    
    path = Path(file_path)
    if not path.exists():
        return []
        
    ext = path.suffix.lower()
    
    if ext == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else [data]
            
    elif ext == ".csv":
        rows = []
        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                rows.append(dict(r))
        return rows
        
    elif ext in [".xlsx", ".xls"]:
        import openpyxl
        wb = openpyxl.load_workbook(path)
        sheet = wb.active
        rows = []
        # Extract headers from first row
        headers = [cell.value for cell in sheet[1]]
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not any(row):
                continue
            rows.append(dict(zip(headers, row)))
        return rows
        
    return []

def execute_node(state: AgentState) -> Dict[str, Any]:
    """
    Executor Node: Executes steps sequentially, handling dynamic form pauses,
    Human-in-the-loop approvals, bulk execution loops, and REST tool calls.
    """
    plan = list(state.get("plan", []))
    idx = state.get("current_step_index", 0)
    variables = dict(state.get("variables", {}))
    logs = list(state.get("status_logs", []))
    portal_id = state.get("portal_id", "")
    
    # Check if we have completed all steps
    if idx >= len(plan):
        logs.append("All plan operations completed successfully.")
        return {
            "status_logs": logs,
            "interrupt_payload": None
        }
        
    step = plan[idx]
    action_type = step.get("action_type")
    step_id = step.get("id")
    
    # Mark step as running in logs
    if step.get("status") == "pending":
        step["status"] = "running"
        logs.append(f"Starting Step {step.get('step')}: {step.get('description')}")
        
    # Check if this node is returning from an approved HITL interrupt
    # We look for a special execution flag in the variables database
    has_approval = variables.get(f"_approved_{step_id}", False)
    cancelled = variables.get(f"_cancelled_{step_id}", False)
    
    if cancelled:
        step["status"] = "failed"
        logs.append(f"Step {step.get('step')} was rejected/cancelled by user. Aborting plan execution.")
        return {
            "plan": plan,
            "status_logs": logs,
            "interrupt_payload": None
        }
        
    # --- 1. COLLECT INPUT ACTION ---
    if action_type == "collect_input":
        input_fields = step.get("input_fields", [])
        missing_fields = []
        
        for field in input_fields:
            name = field.get("name")
            if name not in variables:
                missing_fields.append(field)
                
        if missing_fields:
            # We have missing inputs! Pause graph and trigger dynamic form
            logs.append(f"Execution halted. Parameters missing. Displaying input collection form...")
            form_payload = {
                "type": "form_request",
                "step_id": step_id,
                "title": step.get("description"),
                "fields": missing_fields
            }
            step["status"] = "interrupted"
            return {
                "plan": plan,
                "status_logs": logs,
                "interrupt_payload": form_payload
            }
            
        # If all fields are collected, mark step as completed and increment
        step["status"] = "completed"
        logs.append(f"Step {step.get('step')}: Dynamic parameters collected successfully.")
        return {
            "plan": plan,
            "current_step_index": idx + 1,
            "status_logs": logs,
            "interrupt_payload": None
        }
        
    # --- 2. MANUAL INSTRUCTION ACTION ---
    elif action_type == "manual_instruction":
        if not has_approval:
            # Trigger confirmation checkbox flow
            logs.append(f"Execution halted. Manual step validation required by operator.")
            hitl_payload = {
                "type": "hitl_request",
                "step_id": step_id,
                "mode": "manual",
                "message": step.get("message"),
                "title": "Manual Checklist Sync"
            }
            step["status"] = "interrupted"
            return {
                "plan": plan,
                "status_logs": logs,
                "interrupt_payload": hitl_payload
            }
            
        step["status"] = "completed"
        logs.append(f"Step {step.get('step')}: Manual validation confirmed.")
        return {
            "plan": plan,
            "current_step_index": idx + 1,
            "status_logs": logs,
            "interrupt_payload": None
        }
        
    # --- 3. API CALL ACTION ---
    elif action_type == "api_call":
        tool_name = step.get("tool_name")
        raw_inputs = step.get("inputs", {})
        
        # Interpolate variables dynamically
        interpolated = interpolate_inputs(raw_inputs, variables)
        
        # Check if the user has uploaded a file for bulk execution mapping
        bulk_file = variables.get("_uploaded_bulk_file")
        bulk_rows = []
        if bulk_file:
            bulk_rows = parse_bulk_file(bulk_file)
            # Remove from variables to prevent loops
            variables["_uploaded_bulk_file"] = None
            
        # Detect mutations & approvals
        requires_approval = step.get("requires_approval", False)
        
        if requires_approval and not has_approval:
            # Pause and ask for Human-in-the-Loop Confirmation
            logs.append(f"Execution halted. Step requires operator authorization.")
            hitl_payload = {
                "type": "hitl_request",
                "step_id": step_id,
                "mode": "api_approval",
                "tool_name": tool_name,
                "inputs": interpolated,
                "title": f"Authorize Action: {tool_name}"
            }
            step["status"] = "interrupted"
            return {
                "plan": plan,
                "status_logs": logs,
                "interrupt_payload": hitl_payload
            }
            
        # --- BULK RUN LOGIC ---
        if bulk_rows:
            logs.append(f"Bulk data detected ({len(bulk_rows)} items). Executing batch mapping loop...")
            success_count = 0
            
            for index, row in enumerate(bulk_rows):
                # Bind spreadsheet row variables to execution scope
                row_vars = variables.copy()
                row_vars.update(row)
                row_inputs = interpolate_inputs(raw_inputs, row_vars)
                row_inputs["portal_id"] = portal_id
                
                # Execute REST call
                logs.append(f"Batch ({index + 1}/{len(bulk_rows)}): Calling {tool_name} for {row.get('email', 'row ' + str(index + 1))}...")
                res = make_http_call(
                    portal_id=portal_id,
                    path=step.get("path", "/users"), # Fallback path
                    method=step.get("method", "post"),
                    param_mappings=[{"name": k, "in": "body"} for k in row_inputs.keys()],
                    kwargs=row_inputs
                )
                
                if res.get("success"):
                    success_count += 1
                    
            step["status"] = "completed"
            logs.append(f"Batch processing completed. Successful calls: {success_count}/{len(bulk_rows)}.")
            return {
                "plan": plan,
                "current_step_index": idx + 1,
                "status_logs": logs,
                "interrupt_payload": None
            }
            
        # --- SINGLE RUN LOGIC ---
        interpolated["portal_id"] = portal_id
        logs.append(f"Executing call: {tool_name} with parameters: {json.dumps(interpolated)}")
        
        # Execute actual HTTP Call
        res = make_http_call(
            portal_id=portal_id,
            path=step.get("path", "/users"), # Map correct paths in database specs
            method=step.get("method", "post"),
            param_mappings=[{"name": k, "in": "body"} for k in interpolated.keys()],
            kwargs=interpolated
        )
        
        if res.get("success"):
            step["status"] = "completed"
            logs.append(f"Step {step.get('step')}: Tool call success. Status {res.get('status_code')}.")
            
            # Map outputs to memory scope for downstream interpolations
            res_data = res.get("data", {})
            if isinstance(res_data, dict):
                for k, v in res_data.items():
                    variables[f"{step_id}.{k}"] = v
                    # Also bind flats
                    variables[k] = v
                    
            return {
                "plan": plan,
                "current_step_index": idx + 1,
                "variables": variables,
                "status_logs": logs,
                "interrupt_payload": None
            }
        else:
            step["status"] = "failed"
            error_msg = res.get("error") or res.get("data", {}).get("detail") or "Unknown API error"
            logs.append(f"Step {step.get('step')} failed with error: {error_msg}")
            
            # Failure policy lookup
            on_fail = step.get("on_failure")
            if on_fail and on_fail.get("action") == "stop":
                return {
                    "plan": plan,
                    "status_logs": logs,
                    "interrupt_payload": None
                }
                
            # Default fallback: halt plan on any API failure
            return {
                "plan": plan,
                "status_logs": logs,
                "interrupt_payload": None
            }
            
    return {
        "plan": plan,
        "status_logs": logs,
        "interrupt_payload": None
    }
