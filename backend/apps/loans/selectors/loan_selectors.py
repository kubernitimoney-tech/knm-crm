from decimal import Decimal

from django.db import models
from django.db.models import Prefetch, Q, Sum
from django.db.models.functions import Coalesce

from apps.accounts.services.role_helpers import (
    can_view_all_collection_pipeline_loans,
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
from apps.applications.models import LoanApplication
from apps.leads.models import LeadStatus
from apps.loans.models import Loan, LoanStatus
from apps.repayments.models import LoanRepayment, RepaymentStatus

STAGE_LOAN_STATUS_MAP: dict[str, frozenset[str]] = {
    "cash-pending": frozenset({LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED}),
    "part-payment": frozenset({LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED}),
    "closed": frozenset({LoanStatus.CLOSED}),
    # Closed via settlement collection (lead SETTLEMENT and/or LoanSettlement row).
    "settlement": frozenset({LoanStatus.CLOSED}),
}

COLLECTION_OPEN_LOAN_STATUSES = STAGE_LOAN_STATUS_MAP["cash-pending"]

SETTLEMENT_LOAN_FILTER = models.Q(settlement__isnull=False) | models.Q(
    application__lead__status=LeadStatus.SETTLEMENT
)


def _base_loan_pipeline_queryset():
    return (
        Loan.objects.filter(is_deleted=False, disbursed_at__isnull=False)
        .select_related(
            "customer",
            "product",
            "branch",
            "application",
            "application__branch",
            "application__lead",
            "application__assigned_cm",
            "application__lead__assigned_cm",
        )
        .prefetch_related(
            "application__decisions",
            "customer__employments",
            "customer__identities",
            Prefetch(
                "repayments",
                queryset=LoanRepayment.objects.filter(
                    status=RepaymentStatus.CONFIRMED,
                ).order_by("-payment_date"),
            ),
            "settlement",
        )
    )


def _loan_assignment_visibility(user) -> models.Q:
    return (
        models.Q(application__assigned_rm=user)
        | models.Q(application__assigned_cm=user)
        | models.Q(application__lead__assigned_rm=user)
        | models.Q(application__lead__assigned_cm=user)
    )


def _loan_cm_pipeline_visibility(user) -> models.Q:
    """Own CM loan assignments; Sr. CM sees every loan assigned to any CM."""
    if is_senior_credit_manager(user):
        return models.Q(application__assigned_cm__isnull=False) | models.Q(
            application__lead__assigned_cm__isnull=False
        )
    return models.Q(application__assigned_cm=user) | models.Q(application__lead__assigned_cm=user)


def collection_pipeline_loan_exists_filter(*, prefix: str = "") -> models.Q:
    """Loans eligible for collection work (disbursed, open, not settled)."""
    return models.Q(
        **{
            f"{prefix}is_deleted": False,
            f"{prefix}disbursed_at__isnull": False,
            f"{prefix}status__in": COLLECTION_OPEN_LOAN_STATUSES,
            f"{prefix}settlement__isnull": True,
        }
    )


def disbursed_loan_exists_filter(*, prefix: str = "") -> models.Q:
    """Any loan that has been disbursed (for collection officer lead access)."""
    return models.Q(
        **{
            f"{prefix}is_deleted": False,
            f"{prefix}disbursed_at__isnull": False,
        }
    )


def loans_for_pipeline_stage(*, user, stage: str):
    statuses = STAGE_LOAN_STATUS_MAP.get(stage)
    if statuses is None:
        return _base_loan_pipeline_queryset().none()

    qs = (
        _base_loan_pipeline_queryset()
        .filter(status__in=statuses)
        .annotate(
            total_collected=Coalesce(
                Sum(
                    "repayments__amount",
                    filter=Q(repayments__status=RepaymentStatus.CONFIRMED),
                ),
                Decimal("0"),
            )
        )
    )
    if stage == "cash-pending":
        # All open active loans — zero collection or partial (part payment), excluding settlements.
        qs = qs.filter(settlement__isnull=True)
    elif stage == "part-payment":
        qs = qs.filter(total_collected__gt=0, settlement__isnull=True)
    elif stage == "settlement":
        qs = qs.filter(SETTLEMENT_LOAN_FILTER)
    elif stage == "closed":
        # Fully closed without settlement so Settlement queue owns waive/settle rows.
        qs = qs.exclude(SETTLEMENT_LOAN_FILTER)

    if can_view_all_collection_pipeline_loans(user):
        return qs.order_by("-disbursed_at", "-created_at")
    if is_senior_credit_manager(user) or is_credit_manager(user):
        return (
            qs.filter(_loan_cm_pipeline_visibility(user))
            .distinct()
            .order_by("-disbursed_at", "-created_at")
        )
    return (
        qs.filter(_loan_assignment_visibility(user))
        .distinct()
        .order_by("-disbursed_at", "-created_at")
    )


def _loan_list_assignment_visibility(user) -> models.Q:
    """
    RM / CM list visibility — mirrors application assignment rules on loan.application.
    """
    visibility = models.Q()

    if is_senior_relationship_manager(user):
        visibility |= models.Q(application__assigned_rm__isnull=False) | models.Q(
            application__lead__assigned_rm__isnull=False
        )
    elif is_relationship_manager(user):
        visibility |= models.Q(application__assigned_rm=user) | models.Q(
            application__lead__assigned_rm=user
        )

    if is_senior_credit_manager(user) or is_credit_manager(user):
        visibility |= _loan_cm_pipeline_visibility(user)

    if not visibility:
        visibility = _loan_assignment_visibility(user)
    return visibility


def visible_loans_for(user):
    """
    Loans visible to the user — aligned with application/lead assignment and
    finance/collection pipeline rules used elsewhere (no full-portfolio list).

    Sr. RM / Sr. CM org-wide widening matches visible_applications_for (intentional).
    """
    qs = (
        Loan.objects.filter(is_deleted=False)
        .select_related(
            "customer",
            "product",
            "application",
            "branch",
            "application__lead",
            "application__assigned_rm",
            "application__assigned_cm",
            "application__lead__assigned_rm",
            "application__lead__assigned_cm",
        )
        .order_by("-created_at")
    )
    if is_super_admin(user) or is_admin_user(user):
        return qs
    if is_collection_officer(user):
        return qs.filter(disbursed_at__isnull=False)
    if is_account_finance(user):
        return qs.filter(
            application__is_deleted=False,
            application__status__in=FINANCE_VISIBLE_STATUSES,
        )
    return qs.filter(_loan_list_assignment_visibility(user)).distinct()


def list_applications(*, user):
    return LoanApplication.objects.filter(is_deleted=False).select_related(
        "customer", "product", "current_state"
    )


def get_application_detail(application_id):
    return (
        LoanApplication.objects.select_related(
            "customer", "product", "branch", "lead", "current_state"
        )
        .prefetch_related("decisions")
        .get(pk=application_id)
    )


def list_loans(*, user):
    return visible_loans_for(user)
