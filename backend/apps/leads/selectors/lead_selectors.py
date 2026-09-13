"""Lead queryset builders with list/detail prefetch plans to avoid N+1 on list APIs."""

from django.db.models import OuterRef, Prefetch, Subquery

from apps.applications.models import LoanApplication
from apps.leads.models import CallLog, Lead


def annotate_latest_call_disposition(qs):
    latest_call = CallLog.objects.filter(lead_id=OuterRef("pk")).order_by("-created_at")
    return qs.annotate(
        latest_call_disposition=Subquery(latest_call.values("disposition")[:1]),
    )


def lead_list_prefetches():
    """Prefetch paths used by LeadListSerializer (identities, applications, employment, address)."""
    return (
        Prefetch(
            "applications",
            queryset=LoanApplication.objects.filter(is_deleted=False).order_by("-created_at"),
        ),
        "customer__identities",
        "customer__employments",
        "customer__addresses",
        "customer__references",
    )


def lead_list_queryset():
    """Base queryset for lead list and detail views."""
    return annotate_latest_call_disposition(
        Lead.objects.filter(is_deleted=False)
        .select_related(
            "customer",
            "source",
            "assigned_rm",
            "assigned_cm",
            "interested_product",
            "converted_application",
        )
        .prefetch_related(*lead_list_prefetches())
    )


def lead_detail_queryset():
    """List queryset plus call logs and assignment history for retrieve/update flows."""
    return lead_list_queryset().prefetch_related(
        "call_logs__created_by",
        "assignment_history",
    )


def get_lead_detail(lead_id):
    return lead_detail_queryset().get(pk=lead_id)
