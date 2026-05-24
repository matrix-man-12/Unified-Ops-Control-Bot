from typing import List, Dict, Any, Optional, TypedDict
from langchain_core.messages import BaseMessage

class ExecutionStep(TypedDict):
    step: int
    id: str
    description: str
    action_type: str  # api_call, collect_input, manual_instruction
    
    # Executable mappings
    tool_name: Optional[str]
    inputs: Optional[Dict[str, Any]]
    requires_approval: Optional[bool]
    
    # Input gathering schemas
    input_fields: Optional[List[Dict[str, Any]]]
    message: Optional[str]
    
    # Status tracking
    status: str # pending, running, completed, failed, interrupted

    # Loop Orchestration
    execution_mode: Optional[str] # "single" or "loop"
    loop_count: Optional[int]
    current_loop_index: Optional[int]
    parameter_list: Optional[List[Dict[str, Any]]]
    loop_results: Optional[Dict[str, Any]] # e.g. {"passed": 0, "failed": 0, "details": []}
    polling_config: Optional[Dict[str, Any]] # e.g. {"interval_seconds": 2, "max_attempts": 10, "status_check_endpoint": "/uploads/{file_id}/status", "success_value": "ready"}


class AgentState(TypedDict):
    # Standard LangGraph history
    messages: List[BaseMessage]
    
    # Active portal routing mappings
    portal_id: str
    
    # Active parsed project skills
    skills: List[Dict[str, Any]]
    
    # Compiled plan containing scheduled operational nodes
    plan: List[ExecutionStep]
    current_step_index: int
    
    # Interpolation variable database
    variables: Dict[str, Any]
    
    # UI Component Interruption Metadata (HITL data schema)
    # Type payload: form_request or hitl_request
    interrupt_payload: Optional[Dict[str, Any]]
    
    # Real-time execution status streams
    status_logs: List[str]
    
    # Parsed bulk datasets
    bulk_data: Optional[List[Dict[str, Any]]]
    
    # Direct model choice configuration overrides
    model_provider: str # gemini, openai, agent_builder
