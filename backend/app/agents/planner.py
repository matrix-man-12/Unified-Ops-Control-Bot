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

def find_matching_skill(user_query: str, skills: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Determine if a registered YAML skill matches the user's conversational intent."""
    query = user_query.lower()
    for skill in skills:
        yaml_content = yaml_safe_load(skill.get("yaml_content", ""))
        if not yaml_content:
            continue
        # Check name and description matches
        name = yaml_content.get("name", "").lower()
        desc = yaml_content.get("description", "").lower()
        skill_id = yaml_content.get("id", "").lower()
        
        if skill_id in query or name in query or any(word in query and len(word) > 3 for word in name.split()):
            return yaml_content
    return None

def yaml_safe_load(content: str) -> Optional[Dict[str, Any]]:
    """Graceful wrapper around YAML parsing."""
    import yaml
    try:
        return yaml.safe_load(content)
    except Exception:
        return None

def detect_loop_count(query: str) -> int:
    """Detect if the user is asking to execute actions in a loop/batch."""
    # Look for number patterns followed by common terms (users, teams, items, portals, roles)
    match = re.search(r'\b(?:create|add|delete|register|make|run|update|fetch|get)\s+(\d+)\b', query, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    # Check general number followed by words
    match2 = re.search(r'\b(\d+)\s+(?:users|teams|items|portals|roles|departments|files|channels|messages|videos|skills|requests|calls)\b', query, re.IGNORECASE)
    if match2:
        return int(match2.group(1))
        
    return 1

def plan_node(state: AgentState) -> Dict[str, Any]:
    """
    Planner Node: Analyzes intent, binds skills or compiles customized tools sequences,
    and updates the state plan.
    """
    messages = state.get("messages", [])
    user_query = messages[-1].content if messages else ""
    skills = state.get("skills", [])
    portal_id = state.get("portal_id", "")
    provider = state.get("model_provider", settings.LLM_PROVIDER)
    
    logs = list(state.get("status_logs", []))
    logs.append(f"Analyzing operational request: '{user_query}'...")
    
    loop_count = detect_loop_count(user_query)
    is_loop = loop_count > 1
    
    # 1. Compile registered Project Skills context dynamically for the LLM
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
        
    # 2. Compile dynamic Swagger operations context dynamically for the LLM
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
            
    # Pre-extract emails or identifiers inside query for loop parameter pre-population
    emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', user_query)
    initial_params = []
    if is_loop:
        for i in range(loop_count):
            item_params = {}
            if i < len(emails):
                item_params["email"] = emails[i]
                item_params["user_email"] = emails[i]
            initial_params.append(item_params)
            
    logs.append(f"Initializing Dynamic LLM Planner with active skills and API routing tables...")
    
    prompt = f"""
    You are an expert systems operator, compiler, and planner. The user wants to achieve: "{user_query}"
    
    Here is the active Portal API operations context (raw tools):
    {swagger_context}
    
    Here is the list of available Pre-defined Project Skills (reusable templates):
    {skills_context}
    
    Your task is to compile a sequential list of execution steps (runbook plan) to achieve the user's goal.
    
    INTELLIGENT PLANNING RULES:
    1. PRE-DEFINED SKILLS MATCHING: If the user request matches one of the pre-defined Project Skills (e.g. matching the name, description, or intent, like creating a user), you should mimic/compile that skill's step structure. Fill in the 'tool_name', 'path', 'method', and 'param_mappings' exactly as specified in the template.
    2. DYNAMIC API ROUTING: If no pre-defined skill matches the intent, use the raw API operations listed in the Swagger context to compose a custom plan.
    3. VARIABLE EXTRACTION: Extract any variables (such as emails, roles, names, ids) provided by the user in their query, and map them to the 'inputs' fields.
    4. BATCH / LOOP OPERATION:
       - The user wants to execute operations for {loop_count} items (execution_mode: '{"loop" if is_loop else "single"}').
       - Ensure every step in the plan is configured with:
         - execution_mode: "{"loop" if is_loop else "single"}"
         - loop_count: {loop_count}
         - current_loop_index: 0
         - parameter_list: {json.dumps(initial_params) if is_loop else "[]"}
         - loop_results: {{"passed": 0, "failed": 0, "details": []}} if is_loop else null
       - If loop count is > 1, extract any inline parameters for the different items (e.g., if query contains multiple emails) and map them as separate dictionaries inside the 'parameter_list' list.
       
    Output a JSON array representing the steps. Each step must have:
    - step: integer sequence (1, 2, 3...)
    - id: unique step snake_case ID
    - description: what this step is doing
    - action_type: "collect_input" (to gather missing inputs from the user) or "api_call" (to make a REST call) or "manual_instruction"
    - tool_name: target operation name (e.g., "create_user")
    - path: REST URL path (e.g., "/users")
    - method: HTTP method in lowercase (e.g., "post")
    - param_mappings: list of parameter mapping dicts (e.g. [{"name": "email", "in": "body"}])
    - inputs: input key-value binds
    - requires_approval: true (if it's a POST, PUT, DELETE write operation)
    - input_fields: required only for collect_input step. A list of dicts describing required parameters (e.g. [{"name": "email", "type": "string", "required": true, "description": "email"}])
    
    Response format must be a raw JSON array block inside code fences:
    ```json
    [ ... ]
    ```
    """
    
    try:
        llm = get_llm(provider)
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content
        
        # Regex extract JSON array
        json_match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
        if json_match:
            plan_steps = json.loads(json_match.group(0))
            # Format and inject pending status
            for idx, s in enumerate(plan_steps):
                s["step"] = idx + 1
                s["status"] = "pending"
                if "execution_mode" not in s:
                    s["execution_mode"] = "loop" if is_loop else "single"
                    s["loop_count"] = loop_count
                    s["current_loop_index"] = 0
                    s["parameter_list"] = initial_params if is_loop else []
                    s["loop_results"] = {"passed": 0, "failed": 0, "details": []} if is_loop else None
                if "requires_approval" not in s:
                    # Safe default: approve all writes
                    m = s.get("method", "get").lower()
                    s["requires_approval"] = m in ["post", "put", "delete"]
            
            logs.append(f"Successfully compiled plan with {len(plan_steps)} sequential actions using LLM planner.")
            return {
                "plan": plan_steps,
                "current_step_index": 0,
                "status_logs": logs
            }
        else:
            raise ValueError("LLM response did not contain a valid JSON plan array.")
    except Exception as exc:
        logs.append(f"LLM planner compilation failed: {exc}. Creating fallback single action step.")
        # Fallback placeholder single action
        fallback_step = {
            "step": 1,
            "id": "operator_fallback",
            "description": f"Perform manual review of: {user_query}",
            "action_type": "manual_instruction",
            "message": f"Review and resolve request manually: {user_query}",
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
            "status_logs": logs
        }


