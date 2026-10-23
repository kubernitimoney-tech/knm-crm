from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework.test import APIRequestFactory

from apps.repayments.services.online_repayment_service import (
    loan_payment_amount,
    payment_success_from_webhook,
)
from apps.repayments.views.public_repayment_views import PublicLoanRepaymentConfirmAPIView


@pytest.mark.parametrize(
    ("order_amount", "payment_amount", "expected"),
    [
        ("1000.00", "1023.60", Decimal("1000.00")),
        ("1000.00", "1000.00", Decimal("1000.00")),
        ("1000.00", "500.00", Decimal("500.00")),
        (None, "1000.00", Decimal("1000.00")),
        ("1000.00", None, Decimal("1000.00")),
        (None, "NaN", None),
        (None, "Infinity", None),
    ],
)
def test_loan_payment_amount_excludes_fees(order_amount, payment_amount, expected):
    assert (
        loan_payment_amount(
            order={"order_amount": order_amount},
            payment={"payment_amount": payment_amount},
        )
        == expected
    )


def test_success_webhook_excludes_convenience_fee():
    result = payment_success_from_webhook(
        {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {
                    "order_id": "rp-test",
                    "order_amount": "1000.00",
                    "order_tags": {"loan_id": "loan-test"},
                },
                "payment": {
                    "payment_status": "SUCCESS",
                    "payment_amount": "1023.60",
                    "cf_payment_id": "payment-test",
                },
            },
        }
    )
    assert result["amount"] == Decimal("1000.00")


def test_browser_confirmation_excludes_convenience_fee():
    module = "apps.repayments.views.public_repayment_views"
    request = APIRequestFactory().post("/", {"order_id": "rp-test"}, format="json")
    with (
        patch(
            f"{module}.fetch_order",
            return_value={"order_amount": "1000.00", "order_tags": {"loan_id": "loan-test"}},
        ),
        patch(
            f"{module}.fetch_successful_payment",
            return_value={"payment_amount": "1023.60", "cf_payment_id": "payment-test"},
        ),
        patch(f"{module}.record_online_payment") as record,
    ):
        response = PublicLoanRepaymentConfirmAPIView.as_view()(request)
    assert response.status_code == 200
    assert record.call_args.kwargs["amount"] == Decimal("1000.00")


@pytest.mark.django_db
def test_verified_retry_corrects_pending_fee_amount_without_duplicate():
    from django.utils import timezone
    from tests.factories import UserFactory

    from apps.repayments.models import LoanRepayment, RepaymentStatus
    from apps.repayments.services.online_repayment_service import record_online_payment
    from apps.repayments.tests.test_repayment_delete import _create_disbursed_loan, _create_lead

    user = UserFactory()
    lead = _create_lead(lead_code="LD-FEE-RETRY", rm=user, cm=user)
    loan = _create_disbursed_loan(user=user, lead=lead, rm=user, cm=user)
    pending = LoanRepayment.objects.create(
        loan=loan,
        amount=Decimal("1023.60"),
        payment_mode="payment_link",
        payment_date=timezone.now(),
        gateway_reference="rp-fee-retry",
        status=RepaymentStatus.PENDING,
    )
    result = record_online_payment(
        loan_id=str(loan.id), order_id="rp-fee-retry", amount=Decimal("1000.00"), utr="cf-test"
    )
    pending.refresh_from_db()
    assert result.id == pending.id
    assert pending.amount == Decimal("1000.00")
    assert loan.repayments.count() == 1
    pending.status = RepaymentStatus.CONFIRMED
    pending.save(update_fields=["status"])
    record_online_payment(
        loan_id=str(loan.id), order_id="rp-fee-retry", amount=Decimal("500.00"), utr="cf-test"
    )
    pending.refresh_from_db()
    assert pending.amount == Decimal("1000.00")


@pytest.mark.django_db
def test_oversized_pending_payment_approval_keeps_ledger_and_status_unchanged():
    from django.utils import timezone
    from tests.factories import UserFactory

    from apps.ledger.services.ledger_posting_service import LedgerPostingService
    from apps.repayments.models import LoanRepayment, RepaymentStatus
    from apps.repayments.services.online_repayment_service import approve_online_payment
    from apps.repayments.services.repayment_service import RepaymentServiceError
    from apps.repayments.tests.test_repayment_delete import _create_disbursed_loan, _create_lead

    user = UserFactory()
    lead = _create_lead(lead_code="LD-FEE-TEST", rm=user, cm=user)
    loan = _create_disbursed_loan(user=user, lead=lead, rm=user, cm=user)
    balance = LedgerPostingService.get_balance(loan.id)
    repayment = LoanRepayment.objects.create(
        loan=loan,
        amount=balance + Decimal("23.60"),
        payment_mode="payment_link",
        payment_date=timezone.now(),
        status=RepaymentStatus.PENDING,
    )
    with pytest.raises(RepaymentServiceError, match="Check convenience fees"):
        approve_online_payment(user=user, loan=loan, repayment_id=repayment.id)
    repayment.refresh_from_db()
    assert repayment.status == RepaymentStatus.PENDING
    assert repayment.ledger_entry_id is None
    assert LedgerPostingService.get_balance(loan.id) == balance
