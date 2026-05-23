from langgraph.graph import StateGraph, END
from app.agents.state import AgentState
from app.agents.planner import plan_node
from app.agents.executor import execute_node

def route_after_planning(state: AgentState) -> str:
    """Route from the planner directly to the executor to begin step run."""
    return "execute"

def route_after_execution(state: AgentState) -> str:
    """
    Decide whether to cycle back, pause on an interrupt, or terminate the workflow.
    """
    interrupt = state.get("interrupt_payload")
    if interrupt is not None:
        # Pause execution, yielding state to the client interface
        return END
        
    plan = state.get("plan", [])
    idx = state.get("current_step_index", 0)
    
    if idx >= len(plan):
        # All steps are finished
        return END
        
    # Standard sequence loop to run the next pending action step
    return "execute"

# Compile the Workflow StateGraph
workflow = StateGraph(AgentState)

# Register the nodes
workflow.add_node("plan", plan_node)
workflow.add_node("execute", execute_node)

# Set the initial entrypoint dynamically based on plan existence
def route_entrypoint(state: AgentState) -> str:
    plan = state.get("plan", [])
    if not plan:
        return "plan"
    return "execute"

workflow.set_conditional_entry_point(
    route_entrypoint,
    {
        "plan": "plan",
        "execute": "execute"
    }
)

# Set edges
workflow.add_conditional_edges(
    "plan",
    route_after_planning,
    {
        "execute": "execute"
    }
)

workflow.add_conditional_edges(
    "execute",
    route_after_execution,
    {
        "execute": "execute",
        "__end__": END
    }
)

# Compile LangGraph engine
compiled_graph = workflow.compile()
