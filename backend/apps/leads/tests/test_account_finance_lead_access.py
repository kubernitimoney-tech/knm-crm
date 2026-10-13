import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import EsignRequestStatus, Lead, LeadEsignRequest, LeadSource


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, rm, cm) -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_rm=rm,
        assigned_cm=cm,
    )


@pytest.mark.django_db
class TestAccountFinanceLeadAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_finance_can_retrieve_disbursal_pipeline_lead(self):
        from apps.products.models import LoanProduct

        rm = UserFactory(email="rm-finance-lead@test.com")
        cm = UserFactory(email="cm-finance-lead@test.com")
        finance = UserFactory(email="finance-lead@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD0601", rm=rm, cm=cm)
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = ApplicationService.create_application(
            user=rm,
            customer=lead.customer,
            product=product,
            data={
                "requested_amount": 50000,
                "tenure_value": 30,
                "assigned_rm": rm,
                "assigned_cm": cm,
            },
        )
        application.lead = lead
        application.status = ApplicationStatus.DISBURSAL_SHEET_SENT
        application.save(update_fields=["lead", "status"])

        client = APIClient()
        client.force_authenticate(user=finance)
        response = client.get(reverse("lead-detail", kwargs={"pk": lead.id}))
        assert response.status_code == status.HTTP_200_OK

    def test_finance_can_retrieve_disbursed_application_lead(self):
        """Disbursal → Disbursed list links into lead detail; finance must open those rows."""
        from apps.products.models import LoanProduct

        rm = UserFactory(email="rm-finance-disbursed@test.com")
        cm = UserFactory(email="cm-finance-disbursed@test.com")
        finance = UserFactory(email="finance-disbursed-lead@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD0604", rm=rm, cm=cm)
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = ApplicationService.create_application(
            user=rm,
            customer=lead.customer,
            product=product,
            data={
                "requested_amount": 50000,
                "tenure_value": 30,
                "assigned_rm": rm,
                "assigned_cm": cm,
            },
        )
        application.lead = lead
        application.status = ApplicationStatus.DISBURSED
        application.save(update_fields=["lead", "status"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        client = APIClient()
        client.force_authenticate(user=finance)
        response = client.get(reverse("lead-detail", kwargs={"pk": lead.id}))
        assert response.status_code == status.HTTP_200_OK
        list_response = client.get(reverse("lead-list"))
        assert list_response.status_code == status.HTTP_200_OK

    def test_finance_can_retrieve_closed_application_lead(self):
        """Closed collection files set application.status=closed; finance must still open lead detail."""
        from apps.products.models import LoanProduct

        rm = UserFactory(email="rm-finance-closed@test.com")
        cm = UserFactory(email="cm-finance-closed@test.com")
        finance = UserFactory(email="finance-closed@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD0603", rm=rm, cm=cm)
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = ApplicationService.create_application(
            user=rm,
            customer=lead.customer,
            product=product,
            data={
                "requested_amount": 50000,
                "tenure_value": 30,
                "assigned_rm": rm,
                "assigned_cm": cm,
            },
        )
        application.lead = lead
        application.status = ApplicationStatus.CLOSED
        application.save(update_fields=["lead", "status"])

        client = APIClient()
        client.force_authenticate(user=finance)
        response = client.get(reverse("lead-detail", kwargs={"pk": lead.id}))
        assert response.status_code == status.HTTP_200_OK

    def test_finance_cannot_retrieve_unrelated_lead(self):
        rm = UserFactory(email="rm-finance-block@test.com")
        cm = UserFactory(email="cm-finance-block@test.com")
        finance = UserFactory(email="finance-block@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD0602", rm=rm, cm=cm)

        client = APIClient()
        client.force_authenticate(user=finance)
        response = client.get(reverse("lead-detail", kwargs={"pk": lead.id}))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_finance_can_read_signed_esign_for_disbursal_gate(self):
        """Disbursal tab unlocks from signed e-sign. Finance has no lead.view."""
        from apps.products.models import LoanProduct

        rm = UserFactory(email="rm-finance-esign@test.com")
        cm = UserFactory(email="cm-finance-esign@test.com")
        finance = UserFactory(email="finance-esign@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD0605", rm=rm, cm=cm)
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = ApplicationService.create_application(
            user=rm,
            customer=lead.customer,
            product=product,
            data={
                "requested_amount": 50000,
                "tenure_value": 30,
                "assigned_rm": rm,
                "assigned_cm": cm,
            },
        )
        application.lead = lead
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status"])
        LeadEsignRequest.objects.create(
            lead=lead,
            status=EsignRequestStatus.SIGNED,
            requested_by=cm,
        )

        client = APIClient()
        client.force_authenticate(user=finance)
        response = client.get(reverse("lead-esign-requests", kwargs={"pk": lead.id}))
        assert response.status_code == status.HTTP_200_OK
        rows = response.data["data"]
        assert len(rows) == 1
        assert rows[0]["status"] == EsignRequestStatus.SIGNED

        denied = client.post(reverse("lead-esign-requests", kwargs={"pk": lead.id}), {})
        assert denied.status_code == status.HTTP_403_FORBIDDEN
