import unittest
import json
from app.agents.api_compiler import compile_openapi_tools, resolve_schema_ref
from app.agents.skill_manager import parse_and_validate_skill_yaml, interpolate_inputs

class TestCompilersSubsystem(unittest.TestCase):

    def setUp(self):
        # 1. Standard mock Swagger schema configuration
        self.mock_swagger = {
            "openapi": "3.0.0",
            "info": {
                "title": "Test Portal",
                "version": "1.0.0"
            },
            "paths": {
                "/users/{id}": {
                    "get": {
                        "operationId": "get_user_by_id",
                        "description": "Fetch user by ID",
                        "parameters": [
                            {
                                "name": "id",
                                "in": "path",
                                "required": True,
                                "schema": {"type": "integer"}
                            }
                        ],
                        "responses": {"200": {"description": "Success"}}
                    }
                }
            }
        }
        
        # 2. Standard mock Project Skill YAML runbook
        self.mock_skill_yaml = """
        id: test_workflow
        name: "Test Operations Runbook"
        description: "Validates workflow steps compile"
        version: "1.0.0"
        steps:
          - step: 1
            id: collect_variables
            description: "Gather operator inputs"
            action_type: "collect_input"
            input_fields:
              - name: "operator_email"
                type: "string"
                required: true
                description: "Operator email"
          - step: 2
            id: run_api
            description: "Execute user lookups"
            action_type: "api_call"
            tool_name: "get_user_by_id"
            inputs:
              id: "{{user_id_ref}}"
            requires_approval: true
        """

    def test_resolve_schema_ref(self):
        """Verify OpenAPI components JSON reference ($ref) resolver recursively binds values."""
        spec = {
            "components": {
                "schemas": {
                    "User": {"type": "object", "properties": {"name": {"type": "string"}}}
                }
            }
        }
        ref_obj = {"$ref": "#/components/schemas/User"}
        resolved = resolve_schema_ref(ref_obj, spec)
        self.assertEqual(resolved.get("type"), "object")
        self.assertIn("properties", resolved)

    def test_api_compiler_structured_tools(self):
        """Verify compiler turns raw Swagger strings into executable LangChain StructuredTools."""
        swagger_str = json.dumps(self.mock_swagger)
        tools = compile_openapi_tools("test-portal-id", swagger_str)
        
        self.assertEqual(len(tools), 1)
        tool = tools[0]
        self.assertEqual(tool.name, "get_user_by_id")
        self.assertEqual(tool.description, "Fetch user by ID")
        self.assertTrue(tool.metadata.get("requires_approval") is False) # GET should not require HITL

    def test_skill_manager_yaml_validator(self):
        """Verify YAML compiler validates and marshals steps structure."""
        validated = parse_and_validate_skill_yaml(self.mock_skill_yaml)
        
        self.assertEqual(validated["id"], "test_workflow")
        self.assertEqual(validated["name"], "Test Operations Runbook")
        self.assertEqual(len(validated["steps"]), 2)
        
        step_one = validated["steps"][0]
        self.assertEqual(step_one["id"], "collect_variables")
        self.assertEqual(step_one["action_type"], "collect_input")
        
        step_two = validated["steps"][1]
        self.assertEqual(step_two["id"], "run_api")
        self.assertEqual(step_two["requires_approval"], True)

    def test_variable_interpolation(self):
        """Verify dynamic double-curly variable bindings resolve inside tool input contexts."""
        raw_inputs = {"id": "{{user_id_ref}}", "static_field": "ops"}
        scope_vars = {"user_id_ref": 105, "ignored_var": "val"}
        
        interpolated = interpolate_inputs(raw_inputs, scope_vars)
        self.assertEqual(interpolated["id"], 105)
        self.assertEqual(interpolated["static_field"], "ops")

if __name__ == "__main__":
    unittest.main()
