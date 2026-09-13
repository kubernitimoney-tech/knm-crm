"""Public and authenticated lead intake (website, ads, social media)."""

from __future__ import annotations

from apps.customers.services.customer_service import CustomerService
from apps.leads.constants import MAX_LEADS_PER_CUSTOMER_PER_HOUR
from apps.leads.models import Lead, LeadSource
from apps.leads.selectors.lead_selectors import get_lead_detail
from apps.leads.services.lead_service import LeadService
from apps.products.models import LoanProduct

CUSTOMER_FIELDS = frozenset({"first_name", "last_name", "email", "mobile_number", "dob", "gender"})

PUBLIC_LEAD_SOURCES: dict[str, tuple[str, str]] = {
    "website": ("website", "Website"),
    "social-media": ("social-media", "Social Media"),
    "social_media": ("social-media", "Social Media"),
    "social": ("social-media", "Social Media"),
    "ads": ("ads", "Ads"),
    "google-ads": ("ads", "Ads"),
    "google_ads": ("ads", "Ads"),
    "facebook-ads": ("ads", "Ads"),
    "meta-ads": ("ads", "Ads"),
}

PUBLIC_LEAD_SOURCE_SLUGS = ("website", "social-media", "ads")


class LeadIntakeError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors or {}


class LeadIntakeService:
    @classmethod
    def resolve_public_source(cls, source_slug: str | None) -> LeadSource:
        key = (source_slug or "website").strip().lower().replace("_", "-")
        canonical_slug, display_name = PUBLIC_LEAD_SOURCES.get(
            key,
            ("website", "Website"),
        )
        source, _ = LeadSource.objects.get_or_create(
            slug=canonical_slug,
            defaults={"name": display_name, "is_active": True},
        )
        if not source.is_active:
            source.is_active = True
            source.save(update_fields=["is_active", "updated_at"])
        return source

    @classmethod
    def list_public_sources(cls) -> list[dict]:
        sources = []
        for slug in PUBLIC_LEAD_SOURCE_SLUGS:
            source = cls.resolve_public_source(slug)
            sources.append(
                {
                    "slug": source.slug,
                    "name": source.name,
                }
            )
        return sources

    @classmethod
    def create_from_validated_data(cls, *, user, data: dict) -> Lead:
        pan = (data.get("pan_no") or "").strip() or None
        aadhaar = (data.get("aadhaar_no") or "").strip() or None

        customer_data = {k: v for k, v in data.items() if k in CUSTOMER_FIELDS}
        employment = data.get("employment")
        address = data.get("address")

        customer, _created = CustomerService.resolve_for_lead(
            user=user,
            pan=pan,
            aadhaar=aadhaar,
            email=data.get("email"),
            mobile=data.get("mobile_number"),
            customer_data=customer_data,
            employment=employment,
            address=address,
        )

        rate_limit_message = LeadService.check_lead_creation_rate_limit(customer)
        if rate_limit_message is not None:
            existing_lead = LeadService.check_existing_active_lead(customer)
            active_payload = None
            if existing_lead is not None:
                rm = existing_lead.assigned_rm
                active_payload = {
                    "lead_id": existing_lead.lead_id,
                    "status": existing_lead.status,
                    "assigned_rm_name": (rm.get_full_name().strip() or rm.email) if rm else None,
                    "assigned_rm_email": rm.email if rm else None,
                }
            raise LeadIntakeError(
                rate_limit_message,
                status_code=429,
                errors={
                    "rate_limit": {
                        "leads_created_last_hour": LeadService.recent_lead_count(customer),
                        "max_per_hour": MAX_LEADS_PER_CUSTOMER_PER_HOUR,
                        "active_lead": active_payload,
                    }
                },
            )

        source = data.get("source")
        if source is None and data.get("source_slug"):
            source = cls.resolve_public_source(data.get("source_slug"))

        product = None
        product_id = data.get("interested_product")
        if product_id:
            product = LoanProduct.objects.filter(id=product_id, is_active=True).first()

        lead = LeadService.create_lead(
            user=user,
            customer=customer,
            data={
                "source": source,
                "required_amount": data.get("required_amount"),
                "interested_product": product,
                "loan_purpose": data.get("loan_purpose"),
            },
        )
        return get_lead_detail(lead.id)

    @classmethod
    def public_response_payload(cls, lead: Lead) -> dict:
        return {
            "id": str(lead.id),
            "lead_id": lead.lead_id,
            "category": lead.category,
            "category_display": lead.get_category_display(),
            "status": lead.status,
            "status_display": lead.get_status_display(),
            "source_slug": lead.source.slug if lead.source_id else None,
            "source_name": lead.source.name if lead.source_id else None,
        }
