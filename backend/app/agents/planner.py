import json
import re
from typing import Dict, Any, List, Optional
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.state import AgentState, ExecutionStep
from app.database import get_portal
from app.agents.api_compiler import compile_openapi_tools

def get_llm(provider: str) -> Any:
    """Load the designated LLM provider dynamically based on config settings."""
    prov = provider.lower() if provider else settings.LLM_PROVIDER
    if prov == "gemini":
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL_NAME,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.0
        )
    elif prov == "agent_builder":
        return ChatOpenAI(
            model=settings.AGENT_BUILDER_MODEL,
            openai_api_key=settings.AGENT_BUILDER_API_KEY,
            openai_api_base=settings.AGENT_BUILDER_BASE_URL,
            temperature=0.0
        )
    else:
        return ChatOpenAI(
            model=settings.OPENAI_MODEL_NAME,
            openai_api_key=settings.OPENAI_API_KEY or "local-key",
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.0
        )

def yaml_safe_load(content: str) -> Optional[Dict[str, Any]]:
    """Graceful wrapper around YAML parsing."""
    import yaml
    try:
        return yaml.safe_load(content)
    except Exception:
        return None

def detect_loop_count(query: str, history: str = "") -> int:
    """Fallback loop count parser if semantic mapping needs verification."""
    for text in [query, history]:
        if not text:
            continue
        match = re.search(r'\b(?:create|add|delete|register|make|run|update|fetch|get)\s+(\d+)\b', text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        match2 = re.search(r'\b(\d+)\s+(?:users|teams|items|portals|roles|departments|files|channels|messages|videos|skills|requests|calls)\b', text, re.IGNORECASE)
        if match2:
            return int(match2.group(1))
            
    return 1

def plan_node(state: AgentState) -> Dict[str, Any]:
    """
    Planner Node: High-intelligence semantic classifier, context builder, and runbook compiler.
    Classifies conversational vs operational intents, semantically extracts prompt inputs, 
    auto-prepopulates loop parameter grids to bypass dynamic forms, and designs customized step runbooks.
    """
    messages = state.get("messages", [])
    user_query = messages[-1].content if messages else ""
    skills = state.get("skills", [])
    portal_id = state.get("portal_id", "")
    provider = state.get("model_provider", settings.LLM_PROVIDER)
    
    logs = list(state.get("status_logs", []))
    variables = dict(state.get("variables", {}))
    
    # 1. Bypassing planner if we are returning from an approved plan verification overlay
    if variables.get("_approved_plan"):
        logs.append("Operational runbook checklist approved by system operator. Resuming execution phase.")
        plan = list(state.get("plan", []))
        parameter_list = variables.get("_parameter_list")
        if parameter_list:
            for step in plan:
                step["parameter_list"] = parameter_list
                
        return {
            "plan": plan,
            "current_step_index": 0,
            "status_logs": logs,
            "interrupt_payload": None
        }
        
    logs.append(f"Analyzing operational request: '{user_query}'...")
    
    # Format conversational history context
    history_lines = []
    for msg in messages[:-1]:
        role = "Operator" if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human" else "Agent"
        history_lines.append(f"{role}: {msg.content}")
    history_context = "\n".join(history_lines) if history_lines else "No preceding conversation history."
    
    fallback_loop_count = detect_loop_count(user_query, history_context)
    is_loop_fallback = fallback_loop_count > 1
    
    # 2. Compile pre-defined Project Skills context dynamically for the LLM
    skills_context = "No pre-defined Project Skills registered."
    if skills:
        skills_list = []
        for s in skills:
            yaml_content = yaml_safe_load(s.get("yaml_content", ""))
            if yaml_content:
                skills_list.append({
                  "id": yaml_content.get("id"),
                  "name": yaml_content.get("name"),
                  "description": yaml_content.get("description"),
                  "steps": yaml_content.get("steps")
                })
        skills_context = f"Available Pre-defined Project Skills/Templates:\n{json.dumps(skills_list, indent=2)}"
        
    # 3. Compile active Portal Swagger endpoints mapping dynamically for the LLM
    portal = get_portal(portal_id)
    swagger_context = "No active Swagger OpenAPI specification loaded for this portal."
    if portal and portal.get("swagger_doc"):
        try:
            compiled_tools = compile_openapi_tools(portal_id, portal["swagger_doc"])
            tool_signatures = []
            for t in compiled_tools:
                args = []
                if hasattr(t, "args_schema") and hasattr(t.args_schema, "__fields__"):
                    args = list(t.args_schema.__fields__.keys())
                tool_signatures.append({
                    "name": t.name,
                    "description": t.description or "",
                    "arguments": args,
                    "path": t.metadata.get("path") if hasattr(t, "metadata") else None,
                    "method": t.metadata.get("method") if hasattr(t, "metadata") else None,
                    "param_mappings": t.metadata.get("param_mappings") if hasattr(t, "metadata") else None
                })
            swagger_context = f"Available API operations you can use as tool_name:\n{json.dumps(tool_signatures, indent=2)}"
        except Exception as e:
            swagger_context = f"Active Swagger Spec raw guidelines (compilation issue: {e}):\n{portal['swagger_doc'][:2000]}"
            
    logs.append(f"Invoking Cognitive LLM Planner (provider: '{provider}') to evaluate semantic routing...")
    
    system_prompt_template = """
    You are an expert Systems Architect, Operator, and Runbook Compiler.
    The user is asking: "{USER_QUERY}"
    
    Active Portal Name: "{PORTAL_NAME}"
    Preceding Conversation History:
    {HISTORY_CONTEXT}
    
    Active Swagger Specifications Context:
    {SWAGGER_CONTEXT}
    
    Available Pre-defined Project Skills Context (reusable templates):
    {SKILLS_CONTEXT}
    
    YOUR MISSION:
    You must classify the user's intent and output a valid JSON response.
    
    CLASSIFICATION & ROUTING RULES:
    1. CONVERSATIONAL MODE: If the user query is conversational (e.g. greetings, general questions about how the agent works, asking 'what skills do you have', requesting explanation of a portal spec, or investigatory chat), you must classify this as "conversational". Do NOT generate a runbook checklist for conversational queries! Instead, output a highly intelligent, comprehensive, senior engineer conversational response directly.
    2. OPERATIONAL MODE: If the user query is a request to execute an action, trigger workflows, batch process items, or run portal endpoints (e.g. creating users, registering teams, syncing legacy servers), classify this as "plan". You must construct a highly detailed, sequential runbook checklist.
    
    INTELLIGENT PLANNING & VARIABLE EXTRACTION RULES (for "plan" mode):
    1. PRE-DEFINED SKILLS MATCHING: Semantically evaluate the user's prompt. If it matches a pre-defined Project Skill (reusable template), adopt and compile that skill's step checklist structure, matching the 'tool_name', 'path', 'method', and 'param_mappings' parameters.
    2. DYNAMIC API ROUTING: If no pre-defined template matches, scan the Swagger context. Compose a custom step-by-step checklist of API calls and manual confirmation checks to accomplish the task dynamically.
    3. SEMANTIC PARAMETER EXTRACTION (Super Smart Variable Population):
       - Parse the user query and the chat history to extract *all* parameters and variables provided (such as usernames, emails, roles, team names, IDs, etc.).
       - Map these extracted variables directly to the 'inputs' block (for single steps) or inside the 'parameter_list' array (for loops/batches).
       - For example, if the query contains multiple users: "Add Yogi (yogi@gmail.com, Admin) and Yogi2 (yogi2@gmail.com, Developer)", extract this into:
         "parameter_list": [
            {"username": "Yogi", "email": "yogi@gmail.com", "role": "Administrator"},
            {"username": "Yogi2", "email": "yogi2@gmail.com", "role": "Developer"}
         ]
       - By pre-populating all available parameters here, the systems executor can automatically skip manual 'collect_input' prompts for variables that were already provided, making the execution flow friction-free!
    4. BATCH & LOOP ITERATIONS:
       - Detect if the command requires loop/batch processing (e.g. "Create 5 users" or "Register 3 portals").
       - Set execution_mode: "loop", loop_count: X, parameter_list: [extracted params array], and loop_results: {"passed": 0, "failed": 0, "details": []} for every step in the loop!
       - If the user specifies a loop count but didn't provide enough inline parameters, pre-populate the 'parameter_list' with as many extracted parameters as possible, and configure the rest as empty dictionaries.
       
    OUTPUT JSON FORMAT CONTRACT:
    You must output a single, raw, valid JSON block inside markdown fences. Do not output conversation prefix/suffix texts.
    
    If type is "conversational":
    ```json
    {
      "type": "conversational",
      "response": "Your detailed, exceptionally smart, senior-engineer conversational response here..."
    }
    ```
    
    If type is "plan":
    ```json
    {
      "type": "plan",
      "steps": [
        {
          "step": 1,
          "id": "step_id_snake_case",
          "description": "What this step does",
          "action_type": "collect_input" or "api_call" or "manual_instruction",
          "tool_name": "operationId_from_swagger",
          "path": "endpoint_path_from_swagger (e.g. /users)",
          "method": "http_method_lowercase (e.g. post)",
          "param_mappings": [ { "name": "email", "in": "body" } ],
          "inputs": { "email": "{{email}}" },
          "requires_approval": true (if write mutation: POST, PUT, DELETE),
          "input_fields": [ { "name": "email", "type": "string", "required": true, "description": "User email" } ],
          "execution_mode": "single" or "loop",
          "loop_count": 1,
          "current_loop_index": 0,
          "parameter_list": [],
          "loop_results": null
        }
      ]
    }
    ```
    """
    system_prompt = system_prompt_template.replace("{USER_QUERY}", user_query)
    system_prompt = system_prompt.replace("{PORTAL_NAME}", portal.get('name') if portal else 'Unknown Portal')
    system_prompt = system_prompt.replace("{HISTORY_CONTEXT}", history_context)
    system_prompt = system_prompt.replace("{SWAGGER_CONTEXT}", swagger_context)
    system_prompt = system_prompt.replace("{SKILLS_CONTEXT}", skills_context)

    try:
        llm = get_llm(provider)
        response = llm.invoke([HumanMessage(content=system_prompt)])
        content = response.content
        
        # Regex extract JSON array or object
        json_match = re.search(r'\{\s*".*"\s*:\s*.*\}', content, re.DOTALL)
        if json_match:
            parsed_outcome = json.loads(json_match.group(0))
            
            # --- CASE A: Conversational routing ---
            if parsed_outcome.get("type") == "conversational":
                conversational_text = parsed_outcome.get("response", "I am standing by to assist with your portal operations.")
                logs.append(conversational_text)
                return {
                    "plan": [],
                    "current_step_index": 0,
                    "interrupt_payload": None,
                    "status_logs": logs
                }
                
            # --- CASE B: Operational plan routing ---
            elif parsed_outcome.get("type") == "plan" and parsed_outcome.get("steps"):
                plan_steps = parsed_outcome.get("steps", [])
                
                # Double-check schema structures and inject pending status defaults
                for idx, s in enumerate(plan_steps):
                    s["step"] = idx + 1
                    s["status"] = "pending"
                    
                    if "execution_mode" not in s:
                        s["execution_mode"] = "loop" if is_loop_fallback else "single"
                        s["loop_count"] = fallback_loop_count
                        s["current_loop_index"] = 0
                        s["parameter_list"] = []
                        s["loop_results"] = {"passed": 0, "failed": 0, "details": []} if is_loop_fallback else None
                        
                    if "requires_approval" not in s:
                        m = s.get("method", "get").lower()
                        s["requires_approval"] = m in ["post", "put", "delete"]
                
                # Collate required collect_input parameters to display verification card upfront
                required_fields = []
                seen_fields = set()
                primary_param_list = []
                primary_loop_count = 1
                primary_mode = "single"
                
                if plan_steps:
                    first_step = plan_steps[0]
                    primary_mode = first_step.get("execution_mode", "single")
                    primary_loop_count = first_step.get("loop_count", 1) or 1
                    primary_param_list = first_step.get("parameter_list", []) or []
                    
                for s in plan_steps:
                    if s.get("action_type") == "collect_input" and s.get("input_fields"):
                        for f in s.get("input_fields"):
                            if f.get("name") not in seen_fields:
                                required_fields.append(f)
                                seen_fields.add(f.get("name"))
                                
                logs.append(f"Successfully compiled proposed operational checklist with {len(plan_steps)} steps. Awaiting systems operator verification...")
                
                return {
                    "plan": plan_steps,
                    "current_step_index": 0,
                    "interrupt_payload": {
                        "type": "plan_verification",
                        "step_id": "plan_approve",
                        "title": f"Verify Operational Runbook checklist: '{user_query}'",
                        "steps": plan_steps,
                        "execution_mode": primary_mode,
                        "loop_count": primary_loop_count,
                        "fields": required_fields,
                        "parameter_list": primary_param_list
                    },
                    "status_logs": logs
                }
            else:
                raise ValueError("Parsed outcome structure is invalid.")
        else:
            raise ValueError("LLM response did not contain a valid JSON block.")
            
    except Exception as exc:
        logs.append(f"Cognitive LLM classification failed: {exc}. Initializing fallback manual review checklist.")
        # Safe fallback: create a manual operation checklist step
        fallback_step = {
            "step": 1,
            "id": "operator_manual_review",
            "description": f"Evaluate and execute request manually: {user_query}",
            "action_type": "manual_instruction",
            "message": f"Review, resolve, and confirm task manually inside the portal: {user_query}",
            "status": "pending",
            "execution_mode": "single",
            "loop_count": 1,
            "current_loop_index": 0,
            "parameter_list": [],
            "loop_results": None
        }
        return {
            "plan": [fallback_step],
            "current_step_index": 0,
            "interrupt_payload": {
                "type": "plan_verification",
                "step_id": "plan_approve",
                "title": "Fallback Review Checklist Required",
                "steps": [fallback_step],
                "execution_mode": "single",
                "loop_count": 1,
                "fields": [],
                "parameter_list": []
            },
            "status_logs": logs
        }
