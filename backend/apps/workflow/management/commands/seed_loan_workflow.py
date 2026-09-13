from django.core.management.base import BaseCommand
from django.db import transaction

from apps.workflow.models import Workflow, WorkflowState, WorkflowTransition

STATES = [
    ("draft", "Draft", True, False, 1),
    ("submitted", "Submitted", False, False, 2),
    ("under_review", "Under Review", False, False, 3),
    ("approved", "Approved", False, False, 4),
    ("rejected", "Rejected", False, True, 5),
    ("disbursed", "Disbursed", False, False, 6),
    ("closed", "Closed", False, True, 7),
]

TRANSITIONS = [
    ("draft", "submitted", "submit", "application.submit"),
    ("submitted", "under_review", "review", "application.submit"),
    ("under_review", "approved", "approve", "application.approve"),
    ("under_review", "rejected", "reject", "application.reject"),
    ("approved", "disbursed", "disburse", "disbursal.create"),
    ("disbursed", "closed", "close", "loan.update"),
    ("rejected", "closed", "close", "application.sanction"),
]


class Command(BaseCommand):
    help = "Seed default loan lifecycle workflow"

    @transaction.atomic
    def handle(self, *args, **options):
        workflow, _ = Workflow.objects.get_or_create(
            slug="loan-lifecycle",
            defaults={"name": "Loan Lifecycle", "description": "Standard loan workflow"},
        )
        state_map = {}
        for slug, name, is_initial, is_terminal, order in STATES:
            state, _ = WorkflowState.objects.update_or_create(
                workflow=workflow,
                slug=slug,
                defaults={
                    "name": name,
                    "is_initial": is_initial,
                    "is_terminal": is_terminal,
                    "display_order": order,
                },
            )
            state_map[slug] = state

        for from_slug, to_slug, action, perm in TRANSITIONS:
            WorkflowTransition.objects.update_or_create(
                workflow=workflow,
                from_state=state_map[from_slug],
                to_state=state_map[to_slug],
                action=action,
                defaults={"required_permission": perm},
            )
        self.stdout.write(self.style.SUCCESS("Loan workflow seeded."))
