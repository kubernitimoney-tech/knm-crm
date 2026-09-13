"""Public application status tracking by PAN or mobile (marketing site)."""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import Prefetch

from apps.applications.models import ApplicationStatus, LoanApplication
from apps.customers.services.customer_service import CustomerService
from apps.leads.models import Lead, LeadCategory, LeadStatus
from apps.leads.services.lead_conversion_service import LeadConversionService

# Customer-facing lead statuses that override application status when present.
_LEAD_STATUS_OVERRIDE = frozenset(
    {
        LeadStatus.SETTLEMENT,
        LeadStatus.PAYDAY_PRE_CLOSE,
        LeadStatus.CLOSED,
        LeadStatus.PART_PAYMENT,
        LeadStatus.LOAN_RUNNING,
        LeadStatus.NOT_INTERESTED,
        LeadStatus.DUPLICATE_LEAD,
    }
)

# Plain-language labels for customers (not internal CRM jargon).
_PUBLIC_STATUS_LABELS = {
    LeadStatus.SETTLEMENT: "Settled",
    LeadStatus.PAYDAY_PRE_CLOSE: "Pre-closed",
    LeadStatus.CLOSED: "Closed",
    LeadStatus.PART_PAYMENT: "Part payment",
    LeadStatus.LOAN_RUNNING: "Loan active",
    LeadStatus.RELOAN: "Reloan enquiry",
    LeadStatus.FRESH: "Application received",
    LeadStatus.INTERESTED: "Under review",
    LeadStatus.DOCUMENTS_RECEIVED: "Documents received",
    LeadStatus.NOT_INTERESTED: "Not proceeding",
    LeadStatus.DUPLICATE_LEAD: "Duplicate enquiry",
    ApplicationStatus.DISBURSED: "Disbursed",
    ApplicationStatus.CLOSED: "Closed",
}

TRACK_RATE_LIMIT = 20
TRACK_RATE_WINDOW_SECONDS = 3600


class LeadTrackError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors or {}


class LeadTrackService:
    @classmethod
    def check_rate_limit(cls, *, client_key: str) -> None:
        cache_key = f"lead_track_rate:{client_key}"
        count = cache.get(cache_key, 0)
        if count >= TRACK_RATE_LIMIT:
            raise LeadTrackError(
                "Too many tracking requests. Please try again after some time.",
                status_code=429,
            )
        if count == 0:
            cache.set(cache_key, 1, TRACK_RATE_WINDOW_SECONDS)
        else:
            cache.incr(cache_key)

    @classmethod
    def resolve_public_status(cls, lead: Lead) -> tuple[str, str]:
        """Pick a single customer-facing status from lead + linked application."""
        if lead.status in _LEAD_STATUS_OVERRIDE:
            label = _PUBLIC_STATUS_LABELS.get(lead.status) or lead.get_status_display()
            return lead.status, label

        application = LeadConversionService.resolve_pipeline_application(lead)
        if application is not None:
            if application.status == ApplicationStatus.DISBURSED:
                return ApplicationStatus.DISBURSED, _PUBLIC_STATUS_LABELS[
                    ApplicationStatus.DISBURSED
                ]
            if application.status == ApplicationStatus.CLOSED:
                return ApplicationStatus.CLOSED, _PUBLIC_STATUS_LABELS[ApplicationStatus.CLOSED]

        label = _PUBLIC_STATUS_LABELS.get(lead.status) or lead.get_status_display()
        return lead.status, label

    @classmethod
    def resolve_title(cls, lead: Lead) -> str:
        purpose = (lead.loan_purpose or "").strip()
        if purpose:
            return f"{purpose} enquiry"

        product = (
            getattr(lead.interested_product, "name", None) if lead.interested_product_id else None
        )
        if product:
            return f"{product} enquiry"

        if lead.category == LeadCategory.RELOAN:
            return "Reloan enquiry"
        return "Loan enquiry"

    @classmethod
    def track_applications(
        cls,
        *,
        pan: str | None = None,
        mobile: str | None = None,
        client_key: str = "anon",
    ) -> dict:
        cls.check_rate_limit(client_key=client_key)

        customer = CustomerService.find_by_identifiers(pan=pan, mobile=mobile)
        if customer is None:
            return {"found": False, "applications": []}

        leads = list(
            Lead.objects.filter(customer=customer, is_deleted=False)
            .select_related("converted_application", "source", "interested_product")
            .prefetch_related(
                Prefetch(
                    "applications",
                    queryset=LoanApplication.objects.filter(is_deleted=False).order_by(
                        "-created_at"
                    ),
                )
            )
            .order_by("-created_at")
        )

        applications = []
        for index, lead in enumerate(leads):
            status_code, status_display = cls.resolve_public_status(lead)
            amount = lead.required_amount
            applications.append(
                {
                    "reference_id": lead.lead_id,
                    "title": cls.resolve_title(lead),
                    "is_latest": index == 0,
                    "status": status_code,
                    "status_display": status_display,
                    "required_amount": str(amount) if amount is not None else None,
                    "loan_purpose": (lead.loan_purpose or "").strip() or None,
                    "submitted_at": lead.submitted_at or lead.created_at,
                    "created_at": lead.created_at,
                }
            )

        return {"found": True, "applications": applications}
