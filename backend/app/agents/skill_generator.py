import yaml
import re
from typing import Dict, Any, Optional
from langchain_core.messages import HumanMessage
from app.config import settings
from app.database import get_portal
from app.agents.planner import get_llm
from app.agents.skill_manager import parse_and_validate_skill_yaml

def generate_portal_skill_yaml(portal_id: str, prompt_description: str, provider: str = "gemini", existing_yaml: Optional[str] = None) -> str:
    """
    Skill Generator Agent: Generates a fully validated YAML skill config
    based on the user's plain-text prompt description and the portal's active Swagger spec.
    If existing_yaml is provided, it refines the existing skill draft instead of starting from scratch.
    """
    portal = get_portal(portal_id)
    if not portal:
        raise ValueError(f"Portal configuration with ID '{portal_id}' is not registered.")
        
    swagger_doc = portal.get("swagger_doc", "")
    if not swagger_doc:
        swagger_context = "No Swagger spec loaded for this portal. Generate manual check/checklist steps instead."
    else:
        # Pass a compressed view of the paths and operations to avoid context overflows
        try:
            spec = yaml.safe_load(swagger_doc) or {}
            paths = spec.get("paths", {})
            endpoints = []
            for path, path_obj in paths.items():
                for method, op in path_obj.items():
                    op_id = op.get("operationId", f"{method}_{path.replace('/', '_')}")
                    desc = op.get("description", "") or op.get("summary", "")
                    # Extract parameter guidelines
                    params = op.get("parameters", [])
                    param_names = [p.get("name") for p in params]
                    
                    endpoints.append({
                        "operationId": op_id,
                        "method": method.upper(),
                        "path": path,
                        "description": desc,
                        "parameters": param_names
                    })
            swagger_context = f"Available API operations you can use in steps:\n{yaml.dump(endpoints)}"
        except Exception:
            swagger_context = f"Active Swagger Spec raw guidelines:\n{swagger_doc[:2000]}"

    refinement_instruction = ""
    if existing_yaml:
        refinement_instruction = f"""
We have an EXISTING Project Skill YAML that needs to be updated:
```yaml
{existing_yaml}
```

The user wants to make the following modification/refinement:
"{prompt_description}"

You must modify the existing YAML runbook to incorporate this request. Maintain all existing fields and structure where possible. Only modify steps or fields necessary to satisfy the request. Ensure it still adheres to the schema below.
"""

    system_prompt = f"""
You are an expert Systems Architect and Skill Builder Agent. Your job is to create or refine a valid, fully compiled **Project Skill YAML** file that our LangGraph agent can read and execute.
This skill represents a sequential runbook to automate operations inside the portal with ID '{portal_id}'.

Here is the target portal's active API Swagger context:
{swagger_context}
{refinement_instruction}

{"The user wants to create a skill that does:" if not existing_yaml else "Based on the user refinement request above, modify the YAML. Note the general schema guidelines:"}
"{prompt_description}"

You must output a single, valid YAML document that adheres exactly to the following ProjectSkillSchema format:

```yaml
id: snake_case_unique_skill_id
name: "Clean Human-Readable Title"
description: "Describe what this workflow does so the planner agent can match it"
version: "1.0.0"
steps:
  - step: 1
    id: step_one_unique_id
    description: "Explain what this step does in the plan"
    action_type: "collect_input" # Choices: collect_input, api_call, manual_instruction
    input_fields: # Required only for collect_input
      - name: "email"
        type: "string"
        required: true
        description: "Corporate email address"
  - step: 2
    id: step_two_unique_id
    description: "Call target API"
    action_type: "api_call"
    tool_name: "operationId_from_swagger_context"
    inputs:
      email: "{{email}}" # Interpolates variable from previous step!
    requires_approval: true # Enforce human-in-the-loop for POST, PUT, DELETE write calls
```

Rules for Skill Drafting/Refining:
1. Make sure to use the exact `operationId` under `tool_name` from the swagger context.
2. If the user request implies collecting details (like email, username, team), create a `collect_input` step FIRST to gather them.
3. If an API call is state-modifying (e.g. POST, PUT, DELETE), always set `requires_approval: true`.
4. Output ONLY the raw YAML code block inside fences. Do not add conversational text.

Response Fences:
```yaml
... (valid yaml content)
```
"""

    llm = get_llm(provider)
    response = llm.invoke([HumanMessage(content=system_prompt)])
    content = response.content
    
    # Regex extract YAML code block
    yaml_match = re.search(r'```(?:yaml)?\s*(.*?)\s*```', content, re.DOTALL)
    if yaml_match:
        yaml_content = yaml_match.group(1).strip()
    else:
        yaml_content = content.strip()
        
    return yaml_content
