from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource
from apps.ledger.services.ledger_posting_service import LedgerPostingService
from apps.loans.models import Loan, LoanStatus
from apps.repayments.models import RepaymentStatus
from apps.repayments.services.repayment_service import RepaymentService


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


def _create_disbursed_loan(*, user, lead, rm, cm) -> Loan:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
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

    loan = Loan.objects.create(
        loan_account_number=f"LN-DEL-{lead.lead_id}",
        application=application,
        customer=lead.customer,
        product=product,
        principal_amount=application.requested_amount,
        interest_amount=Decimal("0"),
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=LoanStatus.ACTIVE,
        disbursed_at=timezone.now(),
        created_by=user,
        updated_by=user,
    )
    LedgerPostingService.post_payday_loan_charges(
        loan=loan,
        principal=loan.principal_amount,
        processing_fee=Decimal("0"),
        interest=Decimal("0"),
        user=user,
    )
    return loan


@pytest.mark.django_db
class TestRepaymentDelete:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_delete_repayment_does_not_raise_when_syncing_application_status(self):
        """Regression: ApplicationStatus.CLOSED must exist for collection delete sync."""
        rm = UserFactory(email="rm-repay-del@test.com")
        cm = UserFactory(email="cm-repay-del@test.com")
        officer = UserFactory(email="co-repay-del@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(officer, "collection-officer")

        lead = _create_lead(lead_code="LD0701", rm=rm, cm=cm)
        loan = _create_disbursed_loan(user=cm, lead=lead, rm=rm, cm=cm)

        recorded = RepaymentService.record_repayment(
            user=officer,
            loan=loan,
            amount=Decimal("5000"),
            payment_mode="upi",
            utr="UTR-DEL-001",
        )
        repayment = recorded["repayment"]

        result = RepaymentService.delete_repayment(
            user=officer,
            loan=loan,
            repayment_id=repayment.id,
        )

        repayment.refresh_from_db()
        assert repayment.status == RepaymentStatus.REVERSED
        assert result["repayment_id"] == str(repayment.id)
        assert result["total_collected"] == Decimal("0")

    def test_collection_officer_can_delete_via_api(self):
        rm = UserFactory(email="rm-repay-api@test.com")
        cm = UserFactory(email="cm-repay-api@test.com")
        officer = UserFactory(email="co-repay-api@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(officer, "collection-officer")

        lead = _create_lead(lead_code="LD0702", rm=rm, cm=cm)
        loan = _create_disbursed_loan(user=cm, lead=lead, rm=rm, cm=cm)

        recorded = RepaymentService.record_repayment(
            user=officer,
            loan=loan,
            amount=Decimal("3000"),
            payment_mode="upi",
            utr="UTR-DEL-002",
        )
        repayment = recorded["repayment"]

        client = APIClient()
        client.force_authenticate(user=officer)
        url = reverse(
            "loan-delete-repayment",
            kwargs={"pk": loan.id, "repayment_id": repayment.id},
        )
        response = client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
