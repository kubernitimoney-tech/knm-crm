from django.db.models import Count, Prefetch, Q

from apps.applications.models import ApplicationDecision, ApplicationStatus
from apps.customers.models import Customer
from apps.leads.models import LeadStatus
from apps.repayments.models import LoanRepayment

OTHERS_LEAD_STATUSES = frozenset(
    {
        LeadStatus.DUPLICATE_LEAD,
        LeadStatus.LOAN_RUNNING,
        LeadStatus.PART_PAYMENT,
        LeadStatus.PAYDAY_PRE_CLOSE,
        LeadStatus.CLOSED,
        LeadStatus.SETTLEMENT,
    }
)


def get_customer_list_queryset():
    return (
        Customer.objects.filter(is_deleted=False)
        .annotate(
            total_leads=Count("leads", filter=Q(leads__is_deleted=False)),
            active_loans=Count("loans", filter=Q(loans__is_deleted=False, loans__status="active")),
        )
        .order_by("-created_at")
    )


def _compute_lead_stats(leads_qs):
    """Per-customer lead counts for profile KPI cards."""
    leads = leads_qs.select_related("converted_application")
    applied = leads.count()
    disbursed = 0
    rejected = 0

    disbursed_app_statuses = {
        ApplicationStatus.DISBURSED,
        ApplicationStatus.DISBURSAL_SHEET_SENT,
    }

    disbursed_lead_ids = set()
    rejected_lead_ids = set()

    for lead in leads:
        application = lead.converted_application
        if application is not None:
            if application.status == ApplicationStatus.REJECTED:
                rejected += 1
                rejected_lead_ids.add(lead.id)
            elif application.status in disbursed_app_statuses:
                disbursed += 1
                disbursed_lead_ids.add(lead.id)
        elif lead.status == LeadStatus.NOT_INTERESTED:
            rejected += 1
            rejected_lead_ids.add(lead.id)

    # Mutually exclusive with disbursed/rejected — e.g. legacy loan_running on a disbursed lead.
    others = (
        leads.filter(status__in=OTHERS_LEAD_STATUSES)
        .exclude(id__in=disbursed_lead_ids | rejected_lead_ids)
        .count()
    )
    in_progress = max(applied - disbursed - rejected - others, 0)
    return {
        "applied": applied,
        "disbursed": disbursed,
        "rejected": rejected,
        "others": others,
        "in_progress": in_progress,
    }


def get_customer_profile(*, customer_id, user, focus_lead_id=None):
    customer = Customer.objects.prefetch_related(
        "identities",
        "employments",
        "addresses",
    ).get(pk=customer_id, is_deleted=False)
    from apps.leads.services.lead_service import TERMINAL_LEAD_STATUSES, LeadService

    visible = (
        LeadService.visible_leads_for(user)
        .filter(customer=customer)
        .select_related(
            "converted_application",
            "converted_application__loan",
            "converted_application__product",
        )
        .prefetch_related(
            Prefetch(
                "converted_application__decisions",
                queryset=ApplicationDecision.objects.order_by("-decided_at"),
            ),
            Prefetch(
                "converted_application__loan__repayments",
                queryset=LoanRepayment.objects.filter(payment_date__isnull=False).order_by(
                    "-payment_date"
                ),
            ),
        )
    )
    active_lead = visible.exclude(status__in=TERMINAL_LEAD_STATUSES).order_by("-created_at").first()
    focus_lead = None
    if focus_lead_id:
        focus_lead = visible.filter(pk=focus_lead_id).first()
    profile_lead = focus_lead or active_lead
    call_logs = []
    if profile_lead:
        call_logs = list(profile_lead.call_logs.select_related("created_by").all()[:10])

    return {
        "customer": customer,
        "leads": visible.order_by("-created_at"),
        "active_lead": profile_lead,
        "call_logs": call_logs,
        "lead_stats": _compute_lead_stats(visible),
    }
