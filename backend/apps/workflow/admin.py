from django.contrib import admin

from apps.workflow.models import Workflow, WorkflowState, WorkflowTransition


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "description")


@admin.register(WorkflowState)
class WorkflowStateAdmin(admin.ModelAdmin):
    list_display = ("name", "workflow", "slug", "is_initial", "is_terminal", "display_order")
    list_filter = ("workflow", "is_initial", "is_terminal")
    search_fields = ("name", "slug", "workflow__name", "workflow__slug")


@admin.register(WorkflowTransition)
class WorkflowTransitionAdmin(admin.ModelAdmin):
    list_display = ("workflow", "from_state", "to_state", "action", "required_permission")
    list_filter = ("workflow", "action")
    search_fields = ("action", "required_permission", "workflow__name", "workflow__slug")
    raw_id_fields = ("workflow", "from_state", "to_state")
