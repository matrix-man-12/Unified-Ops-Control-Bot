import json
from typing import Dict, Any, List, Optional
from langchain_core.messages import AIMessage
from app.agents.state import AgentState, ExecutionStep
from app.agents.api_compiler import make_http_call, compile_openapi_tools
from app.agents.skill_manager import interpolate_inputs
from app.database import get_portal

def parse_bulk_file(file_path: str) -> List[Dict[str, Any]]:
    """Parse bulk data files (CSV, JSON, XLSX) using local helpers."""
    import csv
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

import time

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
    execution_mode = step.get("execution_mode", "single")
    loop_count = step.get("loop_count", 1) or 1
    
    # Mark step as running in logs
    if step.get("status") == "pending":
        step["status"] = "running"
        logs.append(f"Starting Step {step.get('step')}: {step.get('description')}")
        
    # Check if this node is returning from an approved HITL interrupt
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
        
        if execution_mode == "loop":
            parameter_list = step.get("parameter_list", []) or []
            
            # Check if parameter_list contains all loop items and has all required fields populated
            needs_collection = False
            if len(parameter_list) < loop_count:
                needs_collection = True
            else:
                for item in parameter_list:
                    for field in input_fields:
                        if field.get("required") and field.get("name") not in item:
                            needs_collection = True
                            break
                            
            if needs_collection:
                logs.append(f"Execution halted. Collecting input parameters for {loop_count} items in bulk form...")
                form_payload = {
                    "type": "form_request",
                    "step_id": step_id,
                    "execution_mode": "loop",
                    "loop_count": loop_count,
                    "title": step.get("description"),
                    "fields": input_fields,
                    "parameter_list": parameter_list
                }
                step["status"] = "interrupted"
                return {
                    "plan": plan,
                    "status_logs": logs,
                    "interrupt_payload": form_payload
                }
                
            # If all bulk parameters are populated, advance
            step["status"] = "completed"
            logs.append(f"Step {step.get('step')}: Bulk parameters collected successfully.")
            return {
                "plan": plan,
                "current_step_index": idx + 1,
                "status_logs": logs,
                "interrupt_payload": None
            }
            
        else:
            # Single mode collect_input
            missing_fields = []
            for field in input_fields:
                name = field.get("name")
                if name not in variables:
                    missing_fields.append(field)
                    
            if missing_fields:
                logs.append(f"Execution halted. Parameters missing. Displaying input collection form...")
                form_payload = {
                    "type": "form_request",
                    "step_id": step_id,
                    "execution_mode": "single",
                    "title": step.get("description"),
                    "fields": missing_fields
                }
                step["status"] = "interrupted"
                return {
                    "plan": plan,
                    "status_logs": logs,
                    "interrupt_payload": form_payload
                }
                
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
        raw_inputs = step.get("inputs", {}) or {}
        requires_approval = step.get("requires_approval", False)
        
        # Determine approval gating
        has_plan_approval = variables.get("_approved_plan", False)
        if requires_approval and not has_approval and not has_plan_approval:
            logs.append(f"Execution halted. Action authorization required by systems operator.")
            
            if execution_mode == "loop":
                parameter_list = step.get("parameter_list", [])
                interpolated_list = []
                for index in range(loop_count):
                    row_vars = variables.copy()
                    if index < len(parameter_list):
                        row_vars.update(parameter_list[index])
                    interpolated_item = interpolate_inputs(raw_inputs, row_vars)
                    interpolated_list.append(interpolated_item)
                    
                hitl_payload = {
                    "type": "hitl_request",
                    "step_id": step_id,
                    "mode": "api_approval",
                    "execution_mode": "loop",
                    "loop_count": loop_count,
                    "tool_name": tool_name,
                    "parameter_list": interpolated_list,
                    "title": f"Authorize Batch Action: {tool_name}"
                }
            else:
                interpolated = interpolate_inputs(raw_inputs, variables)
                hitl_payload = {
                    "type": "hitl_request",
                    "step_id": step_id,
                    "mode": "api_approval",
                    "execution_mode": "single",
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
            
        # --- BATCH/LOOP RUN STATE ENGINE ---
        if execution_mode == "loop":
            parameter_list = step.get("parameter_list", []) or []
            logs.append(f"Starting dynamic batch iteration loop (count = {loop_count})...")
            
            step["loop_results"] = {"passed": 0, "failed": 0, "details": []}
            
            for index in range(loop_count):
                step["current_loop_index"] = index
                row_vars = variables.copy()
                if index < len(parameter_list):
                    row_vars.update(parameter_list[index])
                    
                row_inputs = interpolate_inputs(raw_inputs, row_vars)
                row_inputs["portal_id"] = portal_id
                
                # Fetch dynamic path and method bounds
                path = step.get("path", "/users")
                method = step.get("method", "post")
                param_mappings = step.get("param_mappings") or [{"name": k, "in": "body"} for k in row_inputs.keys()]
                
                # Dynamic interpolation inside paths (e.g. /users/{user_id})
                for k, v in row_vars.items():
                    path = path.replace(f"{{{k}}}", str(v))
                    
                item_desc = row_vars.get("email") or row_vars.get("name") or row_vars.get("id") or f"item {index + 1}"
                logs.append(f"Loop ({index + 1}/{loop_count}): Calling {tool_name} for {item_desc}...")
                
                res = make_http_call(
                    portal_id=portal_id,
                    path=path,
                    method=method,
                    param_mappings=param_mappings,
                    kwargs=row_inputs
                )
                
                # Dynamic skill-driven Polling checking helper
                res_data = res.get("data", {})
                if isinstance(res_data, dict):
                    row_vars.update(res_data)
                    
                poll = step.get("polling_config")
                if res.get("success") and poll:
                    interval = poll.get("interval_seconds", 2)
                    max_attempts = poll.get("max_attempts", 5)
                    status_path = poll.get("status_check_endpoint", "")
                    status_field = poll.get("status_field", "status")
                    success_value = poll.get("success_value", "ready")
                    
                    logs.append(f"Initiating dynamic status verification check for {item_desc}...")
                    
                    for attempt in range(1, max_attempts + 1):
                        time.sleep(interval)
                        # Interpolate check endpoint paths
                        polled_path = status_path
                        for k, v in row_vars.items():
                            polled_path = polled_path.replace(f"{{{k}}}", str(v))
                            
                        logs.append(f"Attempt {attempt}/{max_attempts}: Checking status on '{polled_path}'...")
                        poll_res = make_http_call(
                            portal_id=portal_id,
                            path=polled_path,
                            method="get",
                            param_mappings=[],
                            kwargs={}
                        )
                        
                        if poll_res.get("success"):
                            poll_data = poll_res.get("data", {})
                            current_status = poll_data.get(status_field) if isinstance(poll_data, dict) else ""
                            logs.append(f"Status checked: '{current_status}'")
                            if current_status == success_value:
                                logs.append("Status verified successfully!")
                                res = poll_res
                                break
                        else:
                            logs.append(f"Status check failed: {poll_res.get('error')}")
                            
                # Aggregate results
                if res.get("success"):
                    step["loop_results"]["passed"] += 1
                    step["loop_results"]["details"].append({"index": index, "success": True, "data": res.get("data")})
                    logs.append(f"[{step['loop_results']['passed']} passed, {step['loop_results']['failed']} failed] Loop {index + 1}/{loop_count} success.")
                else:
                    step["loop_results"]["failed"] += 1
                    err_text = res.get("error") or res.get("data", {}).get("detail") or "API error"
                    step["loop_results"]["details"].append({"index": index, "success": False, "error": err_text})
                    logs.append(f"[{step['loop_results']['passed']} passed, {step['loop_results']['failed']} failed] Loop {index + 1}/{loop_count} failed: {err_text}")
                    
            step["status"] = "completed"
            summary_msg = f"Batch processing completed. Final status: {step['loop_results']['passed']} passed, {step['loop_results']['failed']} failed."
            logs.append(summary_msg)
            
            # Map loop outputs back to variables database
            variables[f"{step_id}_results"] = step["loop_results"]
            
            return {
                "plan": plan,
                "current_step_index": idx + 1,
                "variables": variables,
                "status_logs": logs,
                "interrupt_payload": None
            }
            
        else:
            # --- SINGLE RUN ENGINE ---
            interpolated = interpolate_inputs(raw_inputs, variables)
            interpolated["portal_id"] = portal_id
            
            path = step.get("path", "/users")
            method = step.get("method", "post")
            param_mappings = step.get("param_mappings") or [{"name": k, "in": "body"} for k in interpolated.keys()]
            
            # Interpolate dynamic url params
            for k, v in variables.items():
                path = path.replace(f"{{{k}}}", str(v))
                
            logs.append(f"Executing call: {tool_name} with parameters: {json.dumps(interpolated)}")
            
            res = make_http_call(
                portal_id=portal_id,
                path=path,
                method=method,
                param_mappings=param_mappings,
                kwargs=interpolated
            )
            
            # Single status polling checking helper
            res_data = res.get("data", {})
            if isinstance(res_data, dict):
                variables.update(res_data)
                
            poll = step.get("polling_config")
            if res.get("success") and poll:
                interval = poll.get("interval_seconds", 2)
                max_attempts = poll.get("max_attempts", 5)
                status_path = poll.get("status_check_endpoint", "")
                status_field = poll.get("status_field", "status")
                success_value = poll.get("success_value", "ready")
                
                logs.append("Initiating dynamic single status verification check...")
                
                for attempt in range(1, max_attempts + 1):
                    time.sleep(interval)
                    polled_path = status_path
                    for k, v in variables.items():
                        polled_path = polled_path.replace(f"{{{k}}}", str(v))
                        
                    logs.append(f"Attempt {attempt}/{max_attempts}: Checking status on '{polled_path}'...")
                    poll_res = make_http_call(
                        portal_id=portal_id,
                        path=polled_path,
                        method="get",
                        param_mappings=[],
                        kwargs={}
                    )
                    
                    if poll_res.get("success"):
                        poll_data = poll_res.get("data", {})
                        current_status = poll_data.get(status_field) if isinstance(poll_data, dict) else ""
                        logs.append(f"Status checked: '{current_status}'")
                        if current_status == success_value:
                            logs.append("Status verified successfully!")
                            res = poll_res
                            break
                    else:
                        logs.append(f"Status check failed: {poll_res.get('error')}")
                        
            if res.get("success"):
                step["status"] = "completed"
                logs.append(f"Step {step.get('step')}: Tool call success. Status {res.get('status_code')}.")
                
                # Flat map response data
                res_data = res.get("data", {})
                if isinstance(res_data, dict):
                    for k, v in res_data.items():
                        variables[f"{step_id}.{k}"] = v
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
                
                # Halt execution on failure
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

