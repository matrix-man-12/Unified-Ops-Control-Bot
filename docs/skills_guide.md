# Portal Project Skills Guide

This guide describes how to define custom **Project Skills** using declarative YAML files. Project Skills act as "runbooks" or "workflows" that teach your unified agent about UI flows, dependency ordering (e.g., "first click A, then click B"), and validation rules of your portals.

---

## 1. Core Structure of a Skill File

A Project Skill is defined using a standard YAML file with the following root fields:

```yaml
id: unique_identifier        # String ID (snake_case)
name: "Human Readable Name"  # Displayed in UI
description: "Description"   # Helps the LLM Planner understand when to run this
version: "1.0.0"             # Semantic versioning

# Optional safety assertions
safety_policy:
  require_confirmation_for_mutations: true

# The list of steps executing sequentially
steps:
  - step: 1
    id: step_one_id
    description: "What this step does"
    action_type: "api_call"  # Choices: api_call, collect_input, manual_instruction
    tool_name: "tool_name_from_swagger"
    inputs:
      param_key: "{{variable_name}}"
```

---

## 2. Step Action Types

Our LangGraph executor supports three main action types:

### A. `api_call` (Automated API Invocations)
Invokes a tool dynamically generated from your OpenAPI/Swagger specification.
```yaml
- step: 2
  id: create_user
  action_type: "api_call"
  tool_name: "post_api_v1_users"
  inputs:
    email: "{{user_email}}"
    name: "{{user_name}}"
  requires_approval: true  # Triggers a Human-in-the-Loop Confirmation Card in the UI!
```

### B. `collect_input` (Dynamic UI Form Collection)
Instructs the agent to pause execution and request specific inputs from the user. The React frontend dynamically renders a beautiful form using the defined inputs.
```yaml
- step: 1
  id: get_params
  action_type: "collect_input"
  input_fields:
    - name: "user_email"
      type: "string"
      required: true
      description: "Corporate email address"
    - name: "role"
      type: "string"
      required: true
      options: ["Admin", "Developer", "Guest"]
      description: "Permission level inside portal"
```

### C. `manual_instruction` (Operator Steps)
For processes that cannot be automated via API (e.g. manual infrastructure checks, verifying hardware, legacy operations). Renders as a checklist step requiring manual confirmation.
```yaml
- step: 3
  id: hardware_check
  action_type: "manual_instruction"
  message: "Please open the legacy terminal and verify that the DB sync light is green before approving user activation."
```

---

## 3. Dynamic Variable Binding & Interpolation

You can share data between steps using double-curly braces `{{variable_name}}`:
1. Inputs collected in a `collect_input` step (e.g., `user_email`) are stored in the active graph memory.
2. In subsequent `api_call` steps, you can pass these variables: `email: "{{user_email}}"`.
3. If an API call returns a response (like `{ "id": 1234 }`), the response keys are automatically accessible in later steps as `{{step_id.response_key}}` (e.g., `{{create_user.id}}`).

---

## 4. Conditional Jumps and Error Policies

You can specify policies for when a step fails:

```yaml
- step: 1
  id: verify_tenant
  action_type: "api_call"
  tool_name: "get_tenant"
  inputs:
    tenant_id: "{{tenant_id}}"
  on_failure:
    action: "interrupt" # Choices: interrupt, stop, jump_to
    message: "Tenant {{tenant_id}} was not found. Do you wish to create it first?"
```

---

## 5. Security & Safety Best Practices

1. **Avoid Hardcoding Secrets**: Never place API keys, passwords, or session cookies inside the YAML skill. Use `{{secret_placeholder}}` or let the backend dynamic headers automatically inject them from the local `.env` configuration.
2. **Mutations Approval**: Set `requires_approval: true` on any step that modifies state (POST, PUT, DELETE) to protect production portals from errant executions.

---

## 6. Async Status Verification & Repeated Polling Loops

For long-running async background operations (such as compiling video uploads, booting database instances, or running heavy report generations), you can define a dynamic polling configuration directly inside any `api_call` step!

The executor will execute the initial API call, flat-map the response (e.g. capturing dynamic IDs like `upload_id` or `job_id`), and automatically run an async polling loop calling status checks completely generically until the job completes.

### Polling YAML Step Specification:
```yaml
- step: 2
  id: upload_report
  action_type: "api_call"
  tool_name: "post_report"
  inputs:
    name: "quarterly_summary"
  polling_config:
    interval_seconds: 3               # Sleep duration between checks
    max_attempts: 10                  # Max polling cycles before timeout
    status_check_endpoint: "/reports/{id}/status"  # Target check path (supports curly variables interpolation!)
    status_field: "status"            # Field in the response JSON to verify
    success_value: "ready"            # Expected value representing completion success
```
During run, the console diagnostic shell will stream live updates:
- `Attempt 1/10: Checking status on '/reports/8302/status'...`
- `Status response: 'processing'`
- `Attempt 2/10: Checking status on '/reports/8302/status'...`
- `Status response: 'ready'`
- `Status verified successfully! Processing completed.`

