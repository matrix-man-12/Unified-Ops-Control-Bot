import yaml
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# --- Pydantic Validation Schemas for Skills ---

class InputFieldSchema(BaseModel):
    name: str = Field(..., description="Unique variable name for the input parameter")
    type: str = Field("string", description="Type of input field: string, integer, number, boolean")
    required: bool = Field(True, description="Whether this input parameter is mandatory")
    description: str = Field("", description="Field details rendered in the form")
    options: Optional[List[str]] = Field(None, description="Array of choices rendering as a select dropdown")

class StepSchema(BaseModel):
    step: int = Field(..., description="1-indexed sequence number")
    id: str = Field(..., description="Unique step identifier within the skill flow")
    description: str = Field(..., description="Explanation of what this specific step does")
    action_type: str = Field("api_call", description="Type of action: api_call, collect_input, manual_instruction")
    
    # Fields applicable for api_call
    tool_name: Optional[str] = Field(None, description="Target tool operationId mapping")
    inputs: Optional[Dict[str, Any]] = Field(None, description="Static or variable inputs (e.g. {{user_email}})")
    requires_approval: bool = Field(False, description="Enforce a Human-in-the-Loop modal before running")
    
    # Fields applicable for collect_input
    input_fields: Optional[List[InputFieldSchema]] = Field(None, description="List of dynamic form elements to render")
    
    # Fields applicable for manual_instruction
    message: Optional[str] = Field(None, description="Text description prompting manual checklist verification")
    
    # Jumps & Failures policies
    on_failure: Optional[Dict[str, Any]] = Field(None, description="Defines jumps or stops if this step returns failure")

class SafetyPolicySchema(BaseModel):
    require_confirmation_for_mutations: bool = Field(True, description="Always enforce approval for state modifications")

class ProjectSkillSchema(BaseModel):
    id: str = Field(..., description="Unique snake_case identifier")
    name: str = Field(..., description="Display title for the custom skill")
    description: str = Field(..., description="Helps the LLM Planner select when to execute this skill")
    version: str = Field("1.0.0", description="Semantic version string")
    safety_policy: SafetyPolicySchema = Field(default_factory=SafetyPolicySchema)
    steps: List[StepSchema] = Field(..., description="Sequenced operational steps")

# --- Helper Logic ---

def parse_and_validate_skill_yaml(yaml_string: str) -> Dict[str, Any]:
    """Parse raw YAML text and validate it against the strict ProjectSkillSchema."""
    try:
        raw_data = yaml.safe_load(yaml_string)
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML Syntax formatting: {exc}")
        
    if not isinstance(raw_data, dict):
        raise ValueError("Root element of skill file must be a key-value dictionary.")
        
    # Validate structure using Pydantic schema
    validated = ProjectSkillSchema(**raw_data)
    return validated.model_dump()

def interpolate_inputs(inputs: Dict[str, Any], variables: Dict[str, Any]) -> Dict[str, Any]:
    """
    Interpolate execution variables into parameter fields containing {{bracket_placeholders}} or {bracket_placeholders}.
    Example: email: "{{user_email}}" or email: "{user_email}" -> email: "dev@company.com"
    """
    if not inputs:
        return {}
        
    interpolated = {}
    for key, value in inputs.items():
        if isinstance(value, str):
            # Check double curly braces first
            if value.startswith("{{") and value.endswith("}}"):
                var_name = value[2:-2].strip()
                interpolated[key] = variables.get(var_name, value)
            # Check single curly brace fallback
            elif value.startswith("{") and value.endswith("}"):
                var_name = value[1:-1].strip()
                interpolated[key] = variables.get(var_name, value)
            else:
                interpolated[key] = value
        else:
            interpolated[key] = value
            
    return interpolated
