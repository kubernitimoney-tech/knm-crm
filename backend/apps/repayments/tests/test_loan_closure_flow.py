"""Loan close / reopen rules agreed with the business.

1. A closed loan (by collection or manually) stops interest and penalty.
2. Deleting a wrong collection reopens a closed loan with the right status.
3. There is no upper limit on a collection.
4. Payment-link collections credit only the order amount and close the loan
   only once approved.
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource, LeadStatus
from apps.ledger.services.ledger_posting_service import LedgerPostingService
from apps.loans.models import Loan, LoanSettlement, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_closure_service import close_loan_manually, reopen_loan_manually
from apps.repayments.models import LoanRepayment, PaymentMode, RepaymentStatus
from apps.repayments.services.online_repayment_service import approve_online_payment
from apps.repayments.services.repayment_service import RepaymentService

PRINCIPAL = Decimal("10000")


@pytest.fixture
def setup(db):
    call_command("seed_permissions")
    call_command("seed_products")
    from apps.products.models import LoanProduct

    officer = UserFactory(email="accounts-close@test.com")
    UserRole.objects.create(user=officer, role=Role.objects.get(slug="collection-manager"))
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    lead = Lead.objects.create(lead_id="000001", customer=customer, source=source)
    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=officer,
        customer=customer,
        product=product,
        data={"requested_amount": PRINCIPAL, "tenure_value": 10},
    )
    application.lead = lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status"])
    disbursed_at = timezone.now() - timedelta(days=20)
    loan = Loan.objects.create(
        loan_account_number="LN-CLOSE-000001",
        application=application,
        customer=customer,
        product=product,
        principal_amount=PRINCIPAL,
        interest_amount=Decimal("0"),
        total_repayable=PRINCIPAL,
        product_snapshot={"interest_rate": "1"},
        due_date=(disbursed_at + timedelta(days=10)).date(),
        status=LoanStatus.ACTIVE,
        disbursed_at=disbursed_at,
        created_by=officer,
        updated_by=officer,
    )
    LedgerPostingService.post_payday_loan_charges(
        loan=loan,
        principal=PRINCIPAL,
        processing_fee=Decimal("0"),
        interest=Decimal("0"),
        user=officer,
    )
    return officer, lead, loan


def _due_today(loan) -> Decimal:
    loan.refresh_from_db()
    return LoanCalculationService.compute_for_application(loan.application, loan=loan).amount_due


def _collect(officer, loan, amount, utr, when=None):
    loan.refresh_from_db()
    return RepaymentService.record_repayment(
        user=officer,
        loan=loan,
        amount=Decimal(amount),
        payment_mode="upi",
        utr=utr,
        payment_date=when or timezone.now(),
    )


def test_closed_loan_stops_interest_and_penalty_at_close_date(setup):
    officer, lead, loan = setup
    closed_on = timezone.now() - timedelta(days=5)
    _collect(officer, loan, "50000", "UTR-STOP-1", when=closed_on)
    loan.refresh_from_db()
    assert loan.status == LoanStatus.CLOSED
    assert timezone.localtime(loan.closed_at).date() == timezone.localtime(closed_on).date()

    app = loan.application
    today = LoanCalculationService.compute_for_application(app, loan=loan)
    at_close = LoanCalculationService.compute_for_application(
        app, loan=loan, as_of=timezone.localtime(closed_on).date()
    )
    assert today.real_days == at_close.real_days
    assert today.real_interest == at_close.real_interest
    assert today.penalty_interest == at_close.penalty_interest


def test_manual_close_stops_accrual_and_reopen_resumes_it(setup):
    officer, lead, loan = setup
    running = _due_today(loan)
    loan.closed_at = timezone.now() - timedelta(days=8)
    close_loan_manually(loan=loan, user=officer)
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.CLOSED
    assert lead.status == LeadStatus.CLOSED
    assert loan.application.status == ApplicationStatus.CLOSED
    frozen = _due_today(loan)
    assert frozen < running

    reopen_loan_manually(loan=loan, user=officer, new_status=LoanStatus.ACTIVE)
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.ACTIVE and loan.closed_at is None
    assert lead.status == LeadStatus.LOAN_RUNNING
    assert _due_today(loan) == running


def test_closed_loan_without_close_date_falls_back_to_last_collection(setup):
    officer, lead, loan = setup
    paid_on = timezone.now() - timedelta(days=3)
    _collect(officer, loan, "1000", "UTR-SQL-1", when=paid_on)
    # e.g. closed with a direct SQL update: no closed_at, no history
    Loan.objects.filter(pk=loan.pk).update(status=LoanStatus.CLOSED, closed_at=None)
    loan.refresh_from_db()
    assert LoanCalculationService.accrual_end_date(loan) == timezone.localtime(paid_on).date()


def test_deleting_wrong_collection_reopens_loan_as_part_payment(setup):
    officer, lead, loan = setup
    first = _collect(officer, loan, "5000", "UTR-A-5000")
    lead.refresh_from_db()
    assert lead.status == LeadStatus.PART_PAYMENT

    remaining = _due_today(loan) - Decimal("5000")
    wrong = _collect(officer, loan, remaining, "UTR-B-WRONG")
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.CLOSED
    assert lead.status == LeadStatus.CLOSED

    RepaymentService.delete_repayment(user=officer, loan=loan, repayment_id=wrong["repayment"].id)
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.ACTIVE
    assert loan.closed_at is None
    assert loan.application.status == ApplicationStatus.DISBURSED
    assert lead.status == LeadStatus.PART_PAYMENT
    assert first["repayment"].status == RepaymentStatus.CONFIRMED


def test_deleting_settlement_collection_removes_settlement(setup):
    officer, lead, loan = setup
    entry = RepaymentService.record_repayment(
        user=officer,
        loan=loan,
        amount=Decimal("4000"),
        payment_mode="upi",
        utr="UTR-SETTLE",
        collection_status="settlement",
    )
    assert LoanSettlement.objects.filter(loan=loan).exists()
    loan.refresh_from_db()
    RepaymentService.delete_repayment(user=officer, loan=loan, repayment_id=entry["repayment"].id)
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.ACTIVE
    assert not LoanSettlement.objects.filter(loan=loan).exists()
    assert lead.status == LeadStatus.LOAN_RUNNING


def test_collection_above_till_date_amount_is_allowed_and_closes(setup):
    officer, lead, loan = setup
    over = _due_today(loan) + Decimal("1000")
    assert over > LedgerPostingService.get_balance(loan.id)
    result = _collect(officer, loan, over, "UTR-OVER")
    loan.refresh_from_db()
    assert result["repayment"].amount == over
    assert loan.status == LoanStatus.CLOSED
    assert LedgerPostingService.get_balance(loan.id) < 0  # excess held as credit


def test_editing_closed_loan_keeps_original_close_date(setup):
    officer, lead, loan = setup
    closed_on = timezone.now() - timedelta(days=4)
    entry = _collect(officer, loan, "50000", "UTR-KEEP", when=closed_on)
    loan.refresh_from_db()
    original = loan.closed_at
    RepaymentService.update_repayment(
        user=officer,
        loan=loan,
        repayment_id=entry["repayment"].id,
        amount=Decimal("50500"),
    )
    loan.refresh_from_db()
    assert loan.status == LoanStatus.CLOSED
    assert loan.closed_at == original


def test_payment_link_credits_order_amount_and_closes_only_on_approval(setup):
    officer, lead, loan = setup
    order_amount = _due_today(loan) + Decimal("50")  # above ledger outstanding too
    pending = LoanRepayment.objects.create(
        loan=loan,
        amount=order_amount + Decimal("23.60"),  # stored with convenience fee
        payment_mode=PaymentMode.PAYMENT_LINK,
        utr="cf-123",
        payment_date=timezone.now(),
        gateway_reference="rp-test-order",
        status=RepaymentStatus.PENDING,
    )
    loan.refresh_from_db()
    assert loan.status == LoanStatus.ACTIVE  # pending does not close

    order = {"order_amount": str(order_amount), "order_tags": {"loan_id": str(loan.id)}}
    payment = {"payment_status": "SUCCESS", "payment_amount": str(order_amount + Decimal("23.60"))}
    with (
        patch("apps.integrations.cashfree.orders.fetch_order", return_value=order),
        patch("apps.integrations.cashfree.orders.fetch_successful_payment", return_value=payment),
    ):
        approve_online_payment(user=officer, loan=loan, repayment_id=pending.id)

    pending.refresh_from_db()
    loan.refresh_from_db()
    assert pending.status == RepaymentStatus.CONFIRMED
    assert pending.amount == order_amount
    assert loan.status == LoanStatus.CLOSED
    assert loan.closed_at is not None


def test_accounts_can_close_after_repay_date_on_short_payment(setup):
    """Business example: due 11,100 on 15 Oct, customer pays 11,050, accounts close."""
    officer, lead, loan = setup
    paid_on = timezone.now() - timedelta(days=4)  # after the repay date
    loan.refresh_from_db()
    due_then = LoanCalculationService.compute_for_application(
        loan.application, loan=loan, as_of=timezone.localtime(paid_on).date()
    ).amount_due
    short = due_then - Decimal("50")
    result = RepaymentService.record_repayment(
        user=officer,
        loan=loan,
        amount=short,
        payment_mode="upi",
        utr="UTR-SHORT",
        payment_date=paid_on,
        collection_status="close",
    )
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert result["collection_status"] == "close"
    assert loan.status == LoanStatus.CLOSED
    assert lead.status == LeadStatus.CLOSED
    assert timezone.localtime(loan.closed_at).date() == timezone.localtime(paid_on).date()
    # No interest or penalty after the payment day.
    assert _due_today(loan) == due_then
    # The collection row and pipeline keep showing Closed, not Part Payment.
    from apps.repayments.services.collection_status_service import (
        collection_status_for_repayment,
    )

    assert collection_status_for_repayment(result["repayment"]) == ("close", "Closed")
    assert LoanCalculationService.pipeline_status_label(loan) == "Closed"
    history = loan.status_history.filter(to_status=LoanStatus.CLOSED).first()
    assert "short payment (50.00" in history.remarks


def test_short_close_survives_deleting_an_unrelated_collection(setup):
    officer, lead, loan = setup
    extra = _collect(officer, loan, "100", "UTR-EXTRA", when=timezone.now() - timedelta(days=6))
    RepaymentService.record_repayment(
        user=officer,
        loan=loan,
        amount=Decimal("5000"),
        payment_mode="upi",
        utr="UTR-SHORT-2",
        payment_date=timezone.now() - timedelta(days=4),
        collection_status="close",
    )
    loan.refresh_from_db()
    closed_at = loan.closed_at
    RepaymentService.delete_repayment(user=officer, loan=loan, repayment_id=extra["repayment"].id)
    loan.refresh_from_db()
    assert loan.status == LoanStatus.CLOSED
    assert loan.closed_at == closed_at


def test_deleting_the_short_close_collection_reopens_the_loan(setup):
    officer, lead, loan = setup
    _collect(officer, loan, "3000", "UTR-PART", when=timezone.now() - timedelta(days=6))
    close = RepaymentService.record_repayment(
        user=officer,
        loan=loan,
        amount=Decimal("5000"),
        payment_mode="upi",
        utr="UTR-SHORT-3",
        payment_date=timezone.now() - timedelta(days=4),
        collection_status="close",
    )
    loan.refresh_from_db()
    RepaymentService.delete_repayment(user=officer, loan=loan, repayment_id=close["repayment"].id)
    loan.refresh_from_db()
    lead.refresh_from_db()
    assert loan.status == LoanStatus.ACTIVE
    assert loan.closed_at is None
    assert lead.status == LeadStatus.PART_PAYMENT
