from django.db import models

from apps.applications.constants import FINANCE_PIPELINE_STATUSES
from apps.applications.models import ApplicationStatus
from apps.leads.models import CallDisposition, LeadCloserType, LeadStatus
from apps.leads.selectors.lead_selectors import annotate_latest_call_disposition

# Application statuses that mean the lead has left the Fresh/Reloan intake queue.
SANCTIONED_APPLICATION_STATUSES = frozenset(FINANCE_PIPELINE_STATUSES)

# Latest call dispositions that belong on dedicated Status Wise tabs, not Fresh/Reloan.
FRESH_RELOAN_EXCLUDED_CALL_DISPOSITIONS = frozenset(
    {
        CallDisposition.NO_ANSWER,
    }
)

# Closed / rejected leads that should not appear on Status Wise Fresh/Reloan tabs.
FRESH_RELOAN_EXCLUDED_CLOSE_REASONS = frozenset(
    {
        LeadCloserType.DND,
        LeadCloserType.INVALID_NUMBER,
        LeadCloserType.NOT_INTERESTED,
    }
)

# Collection lead statuses that override application "disbursed" in the pipeline badge.
COLLECTION_LEAD_STATUSES = frozenset(
    {
        LeadStatus.PART_PAYMENT,
        LeadStatus.PAYDAY_PRE_CLOSE,
        LeadStatus.SETTLEMENT,
    }
)


def leads_with_sanctioned_application_q() -> models.Q:
    """Leads linked to an application that has been approved or moved past sanction."""
    return models.Q(
        converted_application__status__in=SANCTIONED_APPLICATION_STATUSES,
        converted_application__is_deleted=False,
    ) | models.Q(
        applications__status__in=SANCTIONED_APPLICATION_STATUSES,
        applications__is_deleted=False,
    )


def leads_excluded_from_fresh_reloan_category_q() -> models.Q:
    """Leads that should not appear on Status Wise Fresh/Reloan tabs."""
    return (
        leads_with_sanctioned_application_q()
        | models.Q(status=LeadStatus.NOT_INTERESTED)
        | models.Q(status=LeadStatus.INVALID_NUMBER)
        | models.Q(status=LeadStatus.DUPLICATE_LEAD)
        | models.Q(
            status=LeadStatus.CLOSED,
            close_reason__in=FRESH_RELOAN_EXCLUDED_CLOSE_REASONS,
        )
    )


def exclude_leads_with_sanctioned_application(qs):
    return qs.exclude(leads_with_sanctioned_application_q()).distinct()


def exclude_leads_from_fresh_reloan_category(qs):
    return qs.exclude(leads_excluded_from_fresh_reloan_category_q()).distinct()


def exclude_leads_with_status_wise_call_disposition(qs):
    """Drop leads whose latest call log belongs on Call Back / No Answer tabs."""
    return (
        annotate_latest_call_disposition(qs)
        .filter(
            models.Q(latest_call_disposition__isnull=True)
            | ~models.Q(latest_call_disposition__in=FRESH_RELOAN_EXCLUDED_CALL_DISPOSITIONS)
        )
        .distinct()
    )


def fresh_or_reloan_category_count_filter(category: str) -> models.Q:
    return models.Q(category=category) & ~leads_excluded_from_fresh_reloan_category_q()


def fresh_or_reloan_status_count_filter(status: str) -> models.Q:
    return models.Q(status=status) & ~leads_excluded_from_fresh_reloan_category_q()


def filter_leads_by_latest_call_disposition(qs, call_disposition: str):
    """Filter leads whose most recent call log matches the given disposition."""
    if call_disposition not in CallDisposition.values:
        return qs.none()
    return annotate_latest_call_disposition(qs).filter(latest_call_disposition=call_disposition)


def _application_status_match_q(*statuses: str) -> models.Q:
    """Match pipeline/converted applications that are currently in one of the given statuses."""
    return models.Q(
        converted_application__status__in=statuses,
        converted_application__is_deleted=False,
    ) | models.Q(
        applications__status__in=statuses,
        applications__is_deleted=False,
    )


def _has_application_status_q(*statuses: str) -> models.Q:
    return _application_status_match_q(*statuses)


def _no_active_application_q() -> models.Q:
    return models.Q(converted_application__isnull=True) | models.Q(
        converted_application__is_deleted=True
    )


def constrain_leads_to_status_display(qs, lead_status: str):
    """
    After filtering by lead.status, drop rows whose linked application has advanced so the
    list badge would no longer show that CRM status (All Leads / status filters).
    """
    if lead_status == LeadStatus.INTERESTED:
        # Only pure Interested: no application yet, or app still at interested.
        return qs.filter(
            _no_active_application_q() | _application_status_match_q(ApplicationStatus.INTERESTED)
        ).distinct()

    if lead_status == LeadStatus.DOCUMENTS_PENDING:
        return qs.filter(
            _no_active_application_q()
            | _application_status_match_q(ApplicationStatus.DOCUMENTS_INCOMPLETE)
        ).distinct()

    if lead_status == LeadStatus.DOCUMENTS_RECEIVED:
        return qs.filter(
            _no_active_application_q()
            | _application_status_match_q(ApplicationStatus.DOCUMENTS_RECEIVED)
        ).distinct()

    if lead_status == LeadStatus.NOT_INTERESTED:
        # Exclude application rejected/cancelled (those belong under Rejected / Cancelled filters).
        return qs.exclude(
            _has_application_status_q(
                ApplicationStatus.REJECTED,
                ApplicationStatus.CANCELLED,
            )
        ).distinct()

    return qs


def filter_leads_by_application_status(qs, application_status: str):
    """Match leads to pipeline/reporting application status filters."""
    if application_status == ApplicationStatus.DISBURSED:
        # Exact application disbursed only — do not pull in stale approved rows via loan.disbursed_at.
        return (
            qs.filter(_application_status_match_q(ApplicationStatus.DISBURSED))
            .exclude(status__in=COLLECTION_LEAD_STATUSES)
            .distinct()
        )

    if application_status == ApplicationStatus.INTERESTED:
        return qs.filter(_application_status_match_q(ApplicationStatus.INTERESTED)).distinct()

    if application_status == ApplicationStatus.DOCUMENTS_RECEIVED:
        return qs.filter(
            _application_status_match_q(ApplicationStatus.DOCUMENTS_RECEIVED)
        ).distinct()

    if application_status in (
        ApplicationStatus.DOCUMENTS_INCOMPLETE,
        "documents_pending",
    ):
        # Status-wise Document Pending may use documents_pending alias.
        return qs.filter(
            models.Q(status=LeadStatus.DOCUMENTS_PENDING)
            | _application_status_match_q(ApplicationStatus.DOCUMENTS_INCOMPLETE)
        ).distinct()

    return qs.filter(_application_status_match_q(application_status)).distinct()
