from django.db import models

from apps.accounts.services.role_helpers import (
    is_account_finance,
    is_admin_user,
    is_collection_officer,
    is_credit_manager,
    is_relationship_manager,
    is_senior_credit_manager,
    is_senior_relationship_manager,
    is_super_admin,
)
from apps.applications.constants import FINANCE_VISIBLE_STATUSES
from apps.applications.models import ApplicationStatus, LoanApplication
from apps.loans.selectors.loan_selectors import disbursed_loan_exists_filter

SANCTION_PENDING_STATUSES = frozenset(
    {
        ApplicationStatus.INTERESTED,
        ApplicationStatus.DOCUMENTS_RECEIVED,
        ApplicationStatus.DOCUMENTS_INCOMPLETE,
        ApplicationStatus.DOCUMENTS_VERIFIED,
    }
)

SANCTION_APPROVED_STATUSES = frozenset({ApplicationStatus.APPROVED})

SANCTION_REJECTED_STATUSES = frozenset({ApplicationStatus.REJECTED})

DISBURSAL_SHEET_SENT_STATUSES = frozenset({ApplicationStatus.DISBURSAL_SHEET_SENT})

DISBURSED_STATUSES = frozenset({ApplicationStatus.DISBURSED})

STAGE_STATUS_MAP: dict[str, frozenset[str]] = {
    "sanction-pending": SANCTION_PENDING_STATUSES,
    "sanction-approved": SANCTION_APPROVED_STATUSES,
    "sanction-rejected": SANCTION_REJECTED_STATUSES,
    "enach": SANCTION_APPROVED_STATUSES,
    "disbursal-sheet": DISBURSAL_SHEET_SENT_STATUSES,
    "disbursed": DISBURSED_STATUSES,
}

# Pending/rejected queues: assigned RM or CM; admin / super-admin see all.
SANCTION_QUEUE_STAGES = frozenset({"sanction-pending", "sanction-rejected"})

# Disbursal module queues: assigned CM only; finance / admin / super-admin see all.
CM_DISBURSAL_STAGES = frozenset({"disbursal-sheet", "disbursed"})


def _base_application_queryset():
    return (
        LoanApplication.objects.filter(is_deleted=False)
        .select_related(
            "customer",
            "product",
            "branch",
            "lead",
            "lead__assigned_cm",
            "lead__assigned_rm",
            "assigned_cm",
            "assigned_rm",
            "loan",
        )
        .prefetch_related(
            "decisions",
            "customer__employments",
            "customer__identities",
        )
    )


def _application_assignment_visibility(user) -> models.Q:
    """
    RM / CM visibility: applications linked to leads where the user is assigned
    as RM or CM (on the application or its lead).

    Senior RM / CM roles follow the same widening used for lead lists.

    Sr. RM sees any application with an RM assigned; Sr. CM sees any with a CM assigned.
    This org-wide widening is intentional (multi-branch ops). Branch-scoped territory
    is a future optional epic — do not tighten here without product sign-off.
    """
    visibility = models.Q()

    if is_senior_relationship_manager(user):
        visibility |= models.Q(assigned_rm__isnull=False) | models.Q(
            lead__assigned_rm__isnull=False
        )
    elif is_relationship_manager(user):
        visibility |= models.Q(assigned_rm=user) | models.Q(lead__assigned_rm=user)

    if is_senior_credit_manager(user) or is_credit_manager(user):
        visibility |= _assigned_cm_visibility(user)

    if not visibility:
        visibility = (
            models.Q(assigned_rm=user)
            | models.Q(assigned_cm=user)
            | models.Q(lead__assigned_rm=user)
            | models.Q(lead__assigned_cm=user)
        )
    return visibility


def _assigned_rm_visibility(user) -> models.Q:
    """Assigned RM only (application or linked lead)."""
    return models.Q(assigned_rm=user) | models.Q(lead__assigned_rm=user)


def _is_assigned_rm(user) -> bool:
    return is_relationship_manager(user) or is_senior_relationship_manager(user)


def _assigned_cm_visibility(user) -> models.Q:
    """Own CM assignments; Sr. CM sees every application/lead assigned to any CM."""
    if is_senior_credit_manager(user):
        return models.Q(assigned_cm__isnull=False) | models.Q(lead__assigned_cm__isnull=False)
    return models.Q(assigned_cm=user) | models.Q(lead__assigned_cm=user)


def _is_assigned_cm(user) -> bool:
    return is_credit_manager(user) or is_senior_credit_manager(user)


def _can_view_all_disbursal_records(user) -> bool:
    return is_super_admin(user) or is_admin_user(user) or is_account_finance(user)


def visible_applications_for(user):
    qs = _base_application_queryset()
    if is_super_admin(user) or is_admin_user(user):
        return qs
    if is_collection_officer(user):
        return (
            qs.filter(disbursed_loan_exists_filter(prefix="loan__"))
            .distinct()
            .order_by("-created_at")
        )
    if is_account_finance(user):
        return qs.filter(status__in=FINANCE_VISIBLE_STATUSES).order_by("-created_at")
    return qs.filter(_application_assignment_visibility(user)).distinct()


def applications_for_pipeline_stage(*, user, stage: str):
    statuses = STAGE_STATUS_MAP.get(stage)
    if statuses is None:
        return _base_application_queryset().none()

    qs = _base_application_queryset().filter(status__in=statuses)

    if stage in SANCTION_QUEUE_STAGES:
        if is_super_admin(user) or is_admin_user(user):
            return qs.order_by("-created_at")
        if _is_assigned_rm(user) or _is_assigned_cm(user):
            return (
                qs.filter(_application_assignment_visibility(user))
                .distinct()
                .order_by("-created_at")
            )
        return qs.none()

    if stage in CM_DISBURSAL_STAGES:
        if _can_view_all_disbursal_records(user):
            return qs.order_by("-created_at")
        if _is_assigned_cm(user):
            return qs.filter(_assigned_cm_visibility(user)).distinct().order_by("-created_at")
        return qs.none()

    if stage == "enach":
        if _can_view_all_disbursal_records(user):
            return qs.order_by("-created_at")
        if _is_assigned_cm(user) or _is_assigned_rm(user):
            return (
                qs.filter(_application_assignment_visibility(user))
                .distinct()
                .order_by("-created_at")
            )
        return qs.none()

    if is_super_admin(user) or is_admin_user(user):
        return qs.order_by("-created_at")
    return qs.filter(_application_assignment_visibility(user)).distinct().order_by("-created_at")
