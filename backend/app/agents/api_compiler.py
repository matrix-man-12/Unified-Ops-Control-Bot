import json
import httpx
from typing import Dict, Any, List, Optional, Callable
from pydantic import create_model, BaseModel, Field
from langchain_core.tools import StructuredTool
from app.database import get_portal

def resolve_schema_ref(schema: Dict[str, Any], openapi_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively resolve schema references ($ref) within the OpenAPI specification."""
    if not isinstance(schema, dict):
        return schema
        
    if "$ref" in schema:
        ref_path = schema["$ref"].split("/")
        # Traverses e.g., #/components/schemas/UserCreate
        current = openapi_spec
        for part in ref_path[1:]:
            current = current.get(part, {})
        return resolve_schema_ref(current, openapi_spec)
        
    resolved = {}
    for k, v in schema.items():
        if isinstance(v, dict):
            resolved[k] = resolve_schema_ref(v, openapi_spec)
        elif isinstance(v, list):
            resolved[k] = [resolve_schema_ref(item, openapi_spec) if isinstance(item, dict) else item for item in v]
        else:
            resolved[k] = v
    return resolved

def translate_type_to_python(schema_type: str) -> type:
    """Translate OpenAPI schema types to standard Python primitives."""
    mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict
    }
    return mapping.get(schema_type, str)

def generate_tool_schema(
    operation: Dict[str, Any],
    openapi_spec: Dict[str, Any]
) -> tuple[type[BaseModel], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Parse an OpenAPI operation and dynamically compile a validation Pydantic class
    covering query params, path params, and body params.
    """
    fields: Dict[str, Any] = {}
    param_mappings = [] # Tracks where each param belongs: "query", "path", "header"
    body_schema = None
    
    # 1. Parse explicit parameters list (query, path, headers)
    parameters = operation.get("parameters", [])
    for param in parameters:
        resolved_param = resolve_schema_ref(param, openapi_spec)
        name = resolved_param.get("name")
        in_type = resolved_param.get("in")
        required = resolved_param.get("required", False)
        schema = resolved_param.get("schema", {})
        desc = resolved_param.get("description", "")
        
        py_type = translate_type_to_python(schema.get("type", "string"))
        default_val = ... if required else schema.get("default", None)
        
        fields[name] = (py_type, Field(default=default_val, description=desc))
        param_mappings.append({
            "name": name,
            "in": in_type
        })
        
    # 2. Parse request body specifications
    request_body = operation.get("requestBody")
    if request_body:
        resolved_body = resolve_schema_ref(request_body, openapi_spec)
        content = resolved_body.get("content", {})
        # Prioritize application/json
        json_content = content.get("application/json", {}) or content.get("multipart/form-data", {})
        if json_content and "schema" in json_content:
            body_schema = resolve_schema_ref(json_content["schema"], openapi_spec)
            
            # Map top-level body keys to flat fields
            if body_schema.get("type") == "object":
                properties = body_schema.get("properties", {})
                required_fields = body_schema.get("required", [])
                for name, prop in properties.items():
                    py_type = translate_type_to_python(prop.get("type", "string"))
                    required = name in required_fields
                    default_val = ... if required else prop.get("default", None)
                    desc = prop.get("description", "")
                    
                    fields[name] = (py_type, Field(default=default_val, description=desc))
                    param_mappings.append({
                        "name": name,
                        "in": "body"
                    })
            elif body_schema.get("type") == "array":
                # For bulk endpoints accepting a list at top-level
                fields["payload_list"] = (list, Field(..., description="Array payload list for bulk execution"))
                param_mappings.append({
                    "name": "payload_list",
                    "in": "body_array"
                })

    # Always require target portal_id to resolve URL & credentials at call-time
    fields["portal_id"] = (str, Field(..., description="Target Portal ID config mapping"))
    
    # Create the dynamic validation model
    model_name = f"Args_{operation.get('operationId', 'api_call')}"
    dynamic_model = create_model(model_name, **fields)
    
    return dynamic_model, param_mappings, body_schema

def make_http_call(
    portal_id: str,
    path: str,
    method: str,
    param_mappings: List[Dict[str, Any]],
    kwargs: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute the real-world HTTP API request using dynamic portal configs."""
    portal = get_portal(portal_id)
    if not portal:
        raise ValueError(f"Portal configuration with ID '{portal_id}' not found.")
        
    base_url = portal["base_url"].rstrip("/")
    url = f"{base_url}{path}"
    
    headers = portal["headers"].copy()
    query_params = {}
    json_body = {}
    form_data = {}
    files = {}
    
    # Sort dynamic arguments into path, query, and body locations
    for mapping in param_mappings:
        name = mapping["name"]
        loc = mapping["in"]
        
        if name not in kwargs:
            continue
            
        val = kwargs[name]
        if loc == "path":
            url = url.replace(f"{{{name}}}", str(val))
        elif loc == "query":
            query_params[name] = val
        elif loc == "header":
            headers[name] = str(val)
        elif loc == "body":
            json_body[name] = val
        elif loc == "body_array":
            # Direct array mapping for bulk endpoints
            json_body = val

    # Execute request synchronously using HTTPX
    with httpx.Client(timeout=15.0) as client:
        try:
            if method == "get":
                response = client.get(url, params=query_params, headers=headers)
            elif method == "post":
                # Detect multipart/form-data structure for files
                if "file" in kwargs or any(isinstance(v, str) and v.startswith("file://") for v in kwargs.values()):
                    # Simple mock attachment conversion
                    response = client.post(url, data=json_body, headers=headers)
                else:
                    response = client.post(url, json=json_body, params=query_params, headers=headers)
            elif method == "put":
                response = client.put(url, json=json_body, params=query_params, headers=headers)
            elif method == "delete":
                response = client.delete(url, params=query_params, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            # Try parsing JSON first
            try:
                data = response.json()
            except Exception:
                data = {"text": response.text}
                
            return {
                "status_code": response.status_code,
                "success": response.status_code in [200, 201, 202, 204],
                "data": data
            }
        except httpx.RequestError as exc:
            return {
                "success": False,
                "error": f"HTTP network failure calling {exc.request.url}: {exc}"
            }

def compile_openapi_tools(portal_id: str, swagger_string: str) -> List[StructuredTool]:
    """Parse a Swagger schema and compile executable StructuredTools."""
    try:
        spec = json.loads(swagger_string)
    except json.JSONDecodeError:
        # Fallback to simple mock parser if spec is invalid
        return []
        
    compiled_tools = []
    paths = spec.get("paths", {})
    
    for path, path_obj in paths.items():
        for method, op in path_obj.items():
            if method.lower() not in ["get", "post", "put", "delete"]:
                continue
                
            op_id = op.get("operationId")
            if not op_id:
                # Generate fallback unique operation ID
                clean_path = path.replace("/", "_").replace("{", "").replace("}", "")
                op_id = f"{method.lower()}_{clean_path}"
                
            desc = op.get("description", "") or op.get("summary", "") or f"Executes {method.upper()} on {path}"
            
            # Extract models and argument schemas
            dynamic_model, param_mappings, body_schema = generate_tool_schema(op, spec)
            
            # Detect if this tool is a mutating mutation
            is_mutation = method.lower() in ["post", "put", "delete"]
            
            # Core closure creator to bind tool variables
            def make_tool_fn(p=path, m=method.lower(), mappings=param_mappings):
                def tool_fn(**kwargs) -> Dict[str, Any]:
                    return make_http_call(
                        portal_id=kwargs.get("portal_id"),
                        path=p,
                        method=m,
                        param_mappings=mappings,
                        kwargs=kwargs
                    )
                return tool_fn

            tool = StructuredTool(
                name=op_id,
                description=desc,
                func=make_tool_fn(),
                args_schema=dynamic_model
            )
            
            # Inject structural execution properties
            tool.metadata = {
                "path": path,
                "method": method.lower(),
                "is_mutation": is_mutation,
                "requires_approval": is_mutation, # Safe default: approve all writes
                "is_bulk": "bulk" in path or "bulk" in op_id
            }
            
            compiled_tools.append(tool)
            
    return compiled_tools
