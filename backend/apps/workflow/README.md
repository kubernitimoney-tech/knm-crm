# Workflow App

## 1. Purpose

Data-driven state machine — loan status is NOT hardcoded in Python enums for transitions.

## 2. Structure

`models/workflow.py`, `services/workflow_service.py`, `seed_loan_workflow` command

## 3. Schema

- `Workflow`, `WorkflowState`, `WorkflowTransition` (from_state, to_state, action, required_permission)

## 4. Relationships

`Workflow` 1—* states, 1—* transitions. `LoanApplication.current_state` → `WorkflowState`.

## 5. Sample states

draft → submitted → under_review → approved | rejected → disbursed → closed

## 6. API

`GET /api/v1/workflow/` — requires `workflow.view`

## 7. Permissions

workflow.view, workflow.update

## 8–13. Transition flow

1. Service calls `WorkflowService.validate_transition(workflow, from_state, to_slug, action)`
2. DB must contain matching `WorkflowTransition` row
3. Optional `required_permission` checked against user RBAC
4. On success: update `current_state`, append `LoanStatusHistory`

Seed: `python manage.py seed_loan_workflow`
