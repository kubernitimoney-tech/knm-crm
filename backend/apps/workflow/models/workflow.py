import uuid

from django.db import models


class Workflow(models.Model):
    """
    Defines a reusable state machine (e.g. loan lifecycle).
    Not hardcoded in loan code — transitions are data-driven.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Workflow"
        verbose_name_plural = "Workflows"

    def __str__(self):
        return self.name


class WorkflowState(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name="states",
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    is_initial = models.BooleanField(default=False)
    is_terminal = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Workflow State"
        verbose_name_plural = "Workflow States"
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "slug"],
                name="unique_workflow_state_slug",
            ),
        ]
        ordering = ["display_order"]

    def __str__(self):
        return f"{self.workflow.slug}:{self.slug}"


class WorkflowTransition(models.Model):
    """
    Allowed edge from_state → to_state.
    State machine validation: only defined transitions are legal.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name="transitions",
    )
    from_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name="outgoing_transitions",
    )
    to_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name="incoming_transitions",
    )
    action = models.CharField(
        max_length=50,
        help_text="Business action name e.g. submit, approve.",
    )
    required_permission = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional RBAC code required to perform this transition.",
    )

    class Meta:
        verbose_name = "Workflow Transition"
        verbose_name_plural = "Workflow Transitions"
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "from_state", "to_state", "action"],
                name="unique_workflow_transition",
            ),
        ]

    def __str__(self):
        return f"{self.from_state.slug} -[{self.action}]-> {self.to_state.slug}"
