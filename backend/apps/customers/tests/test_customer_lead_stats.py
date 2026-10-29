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


def _attach_application(*, customer, product, lead, status) -> None:
    application = application_factory(customer=customer, product=product)
    application.lead = lead
    application.status = status
    application.save(update_fields=["lead", "status", "updated_at"])
    lead.converted_application = application
    lead.save(update_fields=["converted_application", "updated_at"])


@pytest.mark.django_db
def test_lead_stats_counts_closed_loans_as_disbursed():
    """5 leads: 1 running + 2 closed loans (all disbursed), 1 rejected, 1 fresh reloan."""
    customer = customer_factory()
    product = loan_product_factory()

    running = _create_lead(customer=customer, lead_code="LD-RUN", status=LeadStatus.LOAN_RUNNING)
    _attach_application(
        customer=customer, product=product, lead=running, status=ApplicationStatus.DISBURSED
    )
    for code in ("LD-CLOSED-1", "LD-CLOSED-2"):
        closed = _create_lead(customer=customer, lead_code=code, status=LeadStatus.CLOSED)
        _attach_application(
            customer=customer, product=product, lead=closed, status=ApplicationStatus.CLOSED
        )
    rejected = _create_lead(customer=customer, lead_code="LD-REJ", status=LeadStatus.NOT_INTERESTED)
    _attach_application(
        customer=customer, product=product, lead=rejected, status=ApplicationStatus.REJECTED
    )
    _create_lead(customer=customer, lead_code="LD-NEW", status=LeadStatus.RELOAN)

    stats = _compute_lead_stats(Lead.objects.filter(customer=customer, is_deleted=False))

    assert stats == {
        "applied": 5,
        "disbursed": 3,
        "rejected": 1,
        "others": 0,
        "in_progress": 1,
    }
