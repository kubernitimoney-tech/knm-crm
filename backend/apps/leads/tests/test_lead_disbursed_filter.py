from datetime import date

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, application_factory, customer_factory, loan_product_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus, LoanApplication
from apps.leads.models import Lead, LeadSource, LeadStatus
from apps.leads.services.lead_application_sync import backfill_missing_application_lead_links
from apps.loans.models import Loan, LoanStatus


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_disbursed_lead_application() -> tuple[Lead, LoanApplication]:
    customer = customer_factory()
    product = loan_product_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    lead = Lead.objects.create(
        lead_id=f"LD-{customer.id.hex[:8].upper()}",
        customer=customer,
        source=source,
        status=LeadStatus.LOAN_RUNNING,
    )
    application = application_factory(customer=customer, product=product)
    application.lead = lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status", "updated_at"])
    lead.converted_application = application
    lead.save(update_fields=["converted_application", "updated_at"])
    Loan.objects.create(
        loan_account_number=f"LN-{application.application_number}",
        application=application,
        customer=customer,
        product=product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=LoanStatus.ACTIVE,
        disbursed_at=timezone.now(),
    )
    return lead, application


@pytest.mark.django_db
class TestLeadDisbursedStatusFilter:
    @pytest.fixture
    def client(self):
        return APIClient()

    def test_disbursed_filter_requires_application_status_disbursed(self, client):
        admin = UserFactory(email="admin-lead-disbursed-filter@test.com")
        _assign_role(admin, "admin")
        client.force_authenticate(user=admin)

        lead, application = _create_disbursed_lead_application()

        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["status", "updated_at"])

        response = client.get(reverse("lead-list"), {"application_status": "disbursed"})
        assert response.status_code == status.HTTP_200_OK
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        assert lead.lead_id not in lead_ids

        application.status = ApplicationStatus.DISBURSED
        application.save(update_fields=["status", "updated_at"])

        response = client.get(reverse("lead-list"), {"application_status": "disbursed"})
        assert response.status_code == status.HTTP_200_OK
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        assert lead.lead_id in lead_ids

    def test_backfill_links_orphan_disbursed_application_to_converted_lead(self):
        lead, application = _create_disbursed_lead_application()

        application.lead = None
        application.save(update_fields=["lead", "updated_at"])

        updated = backfill_missing_application_lead_links()
        assert updated >= 1

        application.refresh_from_db()
        assert application.lead_id == lead.id
