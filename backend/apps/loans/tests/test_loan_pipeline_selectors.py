from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource
from apps.loans.models import Loan, LoanStatus
from apps.loans.selectors.loan_selectors import loans_for_pipeline_stage
from apps.repayments.models import LoanRepayment, PaymentMode, RepaymentStatus


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

    return Loan.objects.create(
        loan_account_number=f"LN-{lead.lead_id}",
        application=application,
        customer=lead.customer,
        product=product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=LoanStatus.ACTIVE,
        disbursed_at=timezone.now(),
    )


@pytest.mark.django_db
class TestSeniorCmCollectionPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_senior_cm_sees_all_collection_pipeline_stages(self):
        rm2 = UserFactory(email="rm2-srcm-collect@test.com")
        rm3 = UserFactory(email="rm3-srcm-collect@test.com")
        cm2 = UserFactory(email="cm2-srcm-collect@test.com")
        cm3 = UserFactory(email="cm3-srcm-collect@test.com")
        sr_cm = UserFactory(email="srcm-collect@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm2, "credit-manager")
        _assign_role(cm3, "credit-manager")
        _assign_role(sr_cm, "senior-credit-manager")

        lead_one = _create_lead(lead_code="LD-COL-01", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD-COL-02", rm=rm3, cm=cm3)

        loan_one = _create_disbursed_loan(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        loan_two = _create_disbursed_loan(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        sr_cash_pending = {
            row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="cash-pending")
        }
        sr_part_payment = {
            row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="part-payment")
        }
        sr_closed = {row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="closed")}

        assert sr_cash_pending == {loan_one.id, loan_two.id}
        assert sr_part_payment == set()
        assert sr_closed == set()

        cm2_rows = list(loans_for_pipeline_stage(user=cm2, stage="cash-pending"))
        assert {row.id for row in cm2_rows} == {loan_one.id}

    def test_cash_pending_includes_zero_and_partial_payment_active_loans(self):
        rm = UserFactory(email="rm-cash-pending-mix@test.com")
        cm = UserFactory(email="cm-cash-pending-mix@test.com")
        sr_cm = UserFactory(email="srcm-cash-pending-mix@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(sr_cm, "senior-credit-manager")

        lead_unpaid = _create_lead(lead_code="LD-CP-01", rm=rm, cm=cm)
        lead_partial = _create_lead(lead_code="LD-CP-02", rm=rm, cm=cm)
        loan_unpaid = _create_disbursed_loan(user=rm, lead=lead_unpaid, rm=rm, cm=cm)
        loan_partial = _create_disbursed_loan(user=rm, lead=lead_partial, rm=rm, cm=cm)
        LoanRepayment.objects.create(
            loan=loan_partial,
            amount=Decimal("5000"),
            payment_mode=PaymentMode.CASH,
            payment_date=timezone.now(),
            status=RepaymentStatus.CONFIRMED,
        )

        cash_pending_ids = {
            row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="cash-pending")
        }
        part_payment_ids = {
            row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="part-payment")
        }

    def test_settlement_stage_lists_settled_closed_loans_only(self):
        from apps.leads.models import LeadStatus
        from apps.loans.models import LoanSettlement

        rm = UserFactory(email="rm-settlement-stage@test.com")
        cm = UserFactory(email="cm-settlement-stage@test.com")
        sr_cm = UserFactory(email="srcm-settlement-stage@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(sr_cm, "senior-credit-manager")

        lead_closed = _create_lead(lead_code="LD-SET-01", rm=rm, cm=cm)
        lead_settled = _create_lead(lead_code="LD-SET-02", rm=rm, cm=cm)
        loan_closed = _create_disbursed_loan(user=rm, lead=lead_closed, rm=rm, cm=cm)
        loan_settled = _create_disbursed_loan(user=rm, lead=lead_settled, rm=rm, cm=cm)

        loan_closed.status = LoanStatus.CLOSED
        loan_closed.closed_at = timezone.now()
        loan_closed.save(update_fields=["status", "closed_at", "updated_at"])
        lead_closed.status = LeadStatus.CLOSED
        lead_closed.save(update_fields=["status", "updated_at"])

        loan_settled.status = LoanStatus.CLOSED
        loan_settled.closed_at = timezone.now()
        loan_settled.save(update_fields=["status", "closed_at", "updated_at"])
        lead_settled.status = LeadStatus.SETTLEMENT
        lead_settled.save(update_fields=["status", "updated_at"])
        LoanSettlement.objects.create(
            loan=loan_settled,
            settlement_amount=Decimal("20000"),
            waiver_amount=Decimal("5000"),
            approved_by=cm,
            settled_at=timezone.now(),
        )

        settlement_ids = {
            row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="settlement")
        }
        closed_ids = {row.id for row in loans_for_pipeline_stage(user=sr_cm, stage="closed")}

        assert settlement_ids == {loan_settled.id}
        assert closed_ids == {loan_closed.id}
