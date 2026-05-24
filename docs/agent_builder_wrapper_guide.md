# Agent Builder LLM Wrapper & Adapter Specification Guide

This developer guide provides comprehensive technical specifications for building an OpenAI-compatible adapter/wrapper around your proprietary corporate **Agent Builder LLM API**. Exposing an OpenAI-compatible chat completion endpoint enables seamless, plug-and-play integration with the Unified Portal Control Agent workspace.

---

## 1. System Context & Wrapper Routing Architecture

Currently, the portal orchestrator instantiates LLMs via LangChain connectors. As defined in [planner.py](../backend/app/agents/planner.py#L21-L27), selecting the **Agent Builder API** in the workspace triggers:

```python
elif prov == "agent_builder":
    return ChatOpenAI(
        model=settings.AGENT_BUILDER_MODEL,
        openai_api_key=settings.AGENT_BUILDER_API_KEY,
        openai_api_base=settings.AGENT_BUILDER_BASE_URL,
        temperature=0.0
    )
```

Because LangChain's `ChatOpenAI` client appends `/chat/completions` to the base URL under the hood, your corporate API adapter must expose an endpoint matching the exact path structure: `http://<your-adapter-host>:<port>/chat/completions`.

```
  +--------------------------------+
  |  Unified Portal Agent Backend  |
  +--------------------------------+
                  |
                  | [LangChain ChatOpenAI requests]
                  | POST http://adapter-host:port/chat/completions
                  v
  +--------------------------------+
  |   Corporate Wrapper Adapter    | <--- Exposes OpenAI schema interface
  +--------------------------------+
                  |
                  | [Proprietary schema conversions]
                  | POST https://corporate.internal.llm/api/v1/generate
                  v
  +--------------------------------+
  |     Corporate LLM Service      |
  +--------------------------------+
```

---

## 2. OpenAI Request & Response Payload Contract

Your wrapper proxy must consume standard OpenAI payloads (which carry a structured array of system and user messages) and translate them into your proprietary corporate LLM format, which expects a single input key named **`input_value`**.

```
   [Standard OpenAI Payload]              [Corporate Wrapper Proxy]           [Proprietary Corporate API]
     Array of messages:                      Collate/serialize into               Post payload containing:
   * system: "System directive"  =======>    a single unified prompt    =======>  { "input_value": "[SYSTEM]: System..." }
   * user: "User operational cmd"            string
```

### A. Proprietary Corporate API Request Schema (JSON)
The internal Agent Builder API takes a simple JSON request containing a single key `input_value`, carrying the collated instruction prompt string:
```json
{
  "input_value": "[SYSTEM]: System prompt instruction directives...\n[USER]: The user query and Swagger specifications context..."
}
```

### B. Wrapper Proxy Request Contract (JSON)
The wrapper adapter itself exposes a standard OpenAI POST endpoint at `/chat/completions`:
```json
{
  "model": "your-corporate-model-id",
  "messages": [
    {
      "role": "system",
      "content": "System prompt text..."
    },
    {
      "role": "user",
      "content": "User input prompt text..."
    }
  ],
  "temperature": 0.0,
  "max_tokens": 4096
}
```

### B. Target API Response Contract (JSON)
The client expects the standard OpenAI choice envelope:
```json
{
  "id": "chatcmpl-uniqueId12345",
  "object": "chat.completion",
  "created": 178229840,
  "model": "your-corporate-model-id",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The generated string content (Raw JSON plan array or YAML skills block)..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 850,
    "total_tokens": 2050
  }
}
```

---

## 3. Required LLM Features & Cognitive Capabilities

To support the agent's advanced operational workflows, your internal LLM must satisfy these key requirements:

### 1. Token Context Window: Min 16k (Ideally 32k+)
The planner node must bundle together large chunks of data including:
* **The Entire OpenAPI Swagger Specification**: Contains routing paths, HTTP methods, authorization details, and object structures.
* **Pre-defined Skill Lists**: Existing registered YAML templates.
* **Conversation History Thread**: Multi-turn historical context.
* **System Prompt Directives**: Long instruction chains.

### 2. High-Fidelity JSON Schema Adherence (`planner.py` Integration)
The Dynamic Planner requires structural precision. When a user issues a command, the LLM must generate a syntax-perfect, un-truncated JSON array block wrapped in markdown fences:
```json
[
  {
    "step": 1,
    "id": "gather_details",
    "description": "Collect email and access role details",
    "action_type": "collect_input",
    "tool_name": "create_user",
    "path": "/users",
    "method": "post",
    "param_mappings": [
      { "name": "email", "in": "body" },
      { "name": "role", "in": "body" }
    ],
    "inputs": {
      "email": "{{email}}",
      "role": "{{role}}"
    },
    "requires_approval": false,
    "input_fields": [
      {
        "name": "email",
        "type": "string",
        "required": true,
        "description": "User corporate email address"
      },
      {
        "name": "role",
        "type": "string",
        "required": true,
        "description": "Assigned access role inside dashboard",
        "options": ["Administrator", "Developer", "Guest"]
      }
    ]
  }
]
```

### 3. Syntax-Perfect YAML Generation (`skill_generator.py` Integration)
In the **Skill Studio**, developers can prompt the agent to draft custom skills. The LLM must synthesize declarative YAML documents matching our Pydantic rules:
* Support dynamic double curly-brace variables binding (`{{variable_name}}`).
* Set `requires_approval: true` for state-modifying REST endpoints (POST, PUT, DELETE).
* Format steps chronologically inside list arrays.

---

## 4. Reference Implementation: Python & FastAPI Wrapper Adapter

If you need to stand up a lightweight proxy helper on your internal network, you can run this **FastAPI Adapter** script. It listens for incoming standard OpenAI calls, translates payloads to your custom corporate endpoints, and returns standard chat structures.

Create a file `app/storage/agent_builder_proxy.py` or run it locally:

```python
import os
import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

app = FastAPI(title="Corporate Agent Builder LLM Wrapper Proxy")

# Enterprise internal endpoints configuration
CORPORATE_LLM_API_URL = os.getenv("CORPORATE_LLM_API_URL", "https://api.internal.corp/llm/v1/generate")

class OpenAIMessage(BaseModel):
    role: str
    content: str

class OpenAICompletionRequest(BaseModel):
    model: str
    messages: List[OpenAIMessage]
    temperature: Optional[float] = 0.0
    max_tokens: Optional[int] = 4096

@app.post("/chat/completions")
async def chat_completions(
    request: OpenAICompletionRequest,
    authorization: Optional[str] = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization headers.")
    
    # 1. Parse standard OpenAI messages to your corporate structure
    # E.g. Combining messages into a single prompt string, or converting to user/system tags
    combined_prompt = ""
    system_instruction = ""
    for msg in request.messages:
        if msg.role == "system":
            system_instruction = msg.content
        else:
            combined_prompt += f"\n[{msg.role.upper()}]: {msg.content}"

    # 2. Collate system instructions and user chat loops into a single input_value string
    collated_prompt = f"[SYSTEM]: {system_instruction}\n{combined_prompt}"
    
    corporate_payload = {
        "input_value": collated_prompt
    }
    
    corporate_headers = {
        "X-Corp-Auth": authorization.replace("Bearer ", ""), # Extract API key
        "Content-Type": "application/json"
    }

    # 3. Request internal corporate LLM service
    async with httpx.AsyncClient() as client:
        try:
            corp_res = await client.post(
                CORPORATE_LLM_API_URL,
                json=corporate_payload,
                headers=corporate_headers,
                timeout=60.0
            )
            
            if corp_res.status_code != 200:
                raise HTTPException(
                    status_code=corp_res.status_code, 
                    detail=f"Enterprise LLM failed: {corp_res.text}"
                )
                
            corp_data = corp_res.json()
            
        except httpx.RequestError as err:
            raise HTTPException(status_code=502, detail=f"Failed to connect to internal LLM service: {err}")

    # 4. Map proprietary output string back to OpenAI-compatible choice schemas
    # E.g. If the API returns the result under "output_value" or "generation_text"
    generated_text = corp_data.get("output_value") or corp_data.get("generation_text", "") or str(corp_data)
    
    openai_response = {
        "id": "chatcmpl-corp-" + os.urandom(8).hex(),
        "object": "chat.completion",
        "created": 178229840,
        "model": request.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": generated_text
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": len(combined_prompt) // 4,      # Estimated counts
            "completion_tokens": len(generated_text) // 4,
            "total_tokens": (len(combined_prompt) + len(generated_text)) // 4
        }
    }

    return openai_response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8050)
```
