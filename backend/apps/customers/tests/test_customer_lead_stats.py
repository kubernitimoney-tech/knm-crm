import pytest
from tests.factories import application_factory, customer_factory, loan_product_factory

from apps.applications.models import ApplicationStatus
from apps.customers.selectors.customer_selectors import _compute_lead_stats
from apps.leads.models import Lead, LeadSource, LeadStatus


def _create_lead(*, customer, lead_code: str, status=LeadStatus.FRESH) -> Lead:
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        status=status,
    )


@pytest.mark.django_db
def test_lead_stats_excludes_disbursed_lead_from_others_when_loan_running():
    """Customer 00047 pattern: disbursed app + loan_running must not double-count in Others."""
    customer = customer_factory()
    product = loan_product_factory()

    closed_lead = _create_lead(customer=customer, lead_code="LD-CLOSED", status=LeadStatus.CLOSED)
    disbursed_lead = _create_lead(
        customer=customer,
        lead_code="LD-DISB",
        status=LeadStatus.LOAN_RUNNING,
    )
    application = application_factory(customer=customer, product=product)
    application.lead = disbursed_lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status", "updated_at"])
    disbursed_lead.converted_application = application
    disbursed_lead.save(update_fields=["converted_application", "updated_at"])

    leads_qs = Lead.objects.filter(customer=customer, is_deleted=False)
    stats = _compute_lead_stats(leads_qs)

    assert stats["applied"] == 2
    assert stats["disbursed"] == 1
    assert stats["others"] == 1
    assert stats["in_progress"] == 0
    assert closed_lead.id != disbursed_lead.id


@pytest.mark.django_db
def test_lead_stats_mutually_exclusive_buckets_sum_to_applied():
    customer = customer_factory()
    product = loan_product_factory()

    _create_lead(customer=customer, lead_code="LD-IP", status=LeadStatus.INTERESTED)
    disbursed_lead = _create_lead(
        customer=customer,
        lead_code="LD-OUT",
        status=LeadStatus.SETTLEMENT,
    )
    application = application_factory(customer=customer, product=product)
    application.lead = disbursed_lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status", "updated_at"])
    disbursed_lead.converted_application = application
    disbursed_lead.save(update_fields=["converted_application", "updated_at"])

    stats = _compute_lead_stats(Lead.objects.filter(customer=customer, is_deleted=False))

    assert (
        stats["disbursed"] + stats["rejected"] + stats["others"] + stats["in_progress"]
        == stats["applied"]
    )
