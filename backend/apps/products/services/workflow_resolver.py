from apps.workflow.models import Workflow, WorkflowState


def resolve_default_workflow() -> Workflow | None:
    workflow = Workflow.objects.filter(slug="payday-loan", is_active=True).first()
    if workflow is None:
        workflow = Workflow.objects.filter(is_active=True).first()
    return workflow


def initial_workflow_state(workflow: Workflow | None) -> WorkflowState | None:
    if workflow is None:
        return None
    return WorkflowState.objects.filter(workflow=workflow, is_initial=True).first()
