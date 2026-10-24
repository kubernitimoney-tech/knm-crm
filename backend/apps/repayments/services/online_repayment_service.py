from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.applications.models import ApplicationStatus
from apps.core.masking import mask_email, mask_mobile, mask_name
from apps.ledger.models import TransactionType
from apps.ledger.services.ledger_posting_service import LedgerPostingError, LedgerPostingService
from apps.loans.models import Loan, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_service import LoanService
from apps.repayments.models import LoanRepayment, PaymentMode, RepaymentStatus
from apps.repayments.services.repayment_service import RepaymentService, RepaymentServiceError

logger = logging.getLogger(__name__)

OPEN_LOAN_STATUSES = (LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED)


def _mobile_digits(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    return digits[-10:]


def find_cash_pending_loan(mobile: str) -> Loan | None:
    """Disbursed open loan for this mobile that still has an amount due.

    Approval creates a loan row before disbursement. Those rows stay Active
    with no disbursed_at, so they must not be offered for repayment.
    """
    digits = _mobile_digits(mobile)
    if len(digits) != 10:
        return None
    loans = (
        Loan.objects.filter(
            is_deleted=False,
            status__in=OPEN_LOAN_STATUSES,
            disbursed_at__isnull=False,
            settlement__isnull=True,
            application__status=ApplicationStatus.DISBURSED,
            application__is_deleted=False,
            customer__is_deleted=False,
            customer__mobile_number__endswith=digits,
        )
        .select_related("customer", "application", "application__lead")
        .order_by("-disbursed_at", "-created_at")
    )
    fallback = None
    for loan in loans:
        if fallback is None:
            fallback = loan
        if payable_amount(loan) > 0:
            return loan
    return fallback


def payable_amount(loan: Loan) -> Decimal:
    application = loan.application
    if application is None:
        return Decimal("0")
    metrics = LoanCalculationService.compute_for_application(application, loan=loan)
    return metrics.till_date_amount


def loan_lookup_payload(loan: Loan) -> dict:
    """Public payload: enough for the borrower to recognise the loan, nothing more.

    This is returned to anyone who types a mobile number, so personal details
    are masked and internal identifiers are not exposed.
    """
    customer = loan.customer
    amount = payable_amount(loan)
    loan_no = LoanService.display_loan_account_number(loan.loan_account_number) or ""
    return {
        "loan_no": f"{'*' * max(len(loan_no) - 4, 0)}{loan_no[-4:]}",
        "customer_name": mask_name(customer.full_name),
        "mobile": mask_mobile(customer.mobile_number),
        "email": mask_email(customer.email),
        "payable_amount": str(amount.quantize(Decimal("0.01"))),
    }


def _as_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not amount.is_finite() or amount <= 0:
        return None
    return amount.quantize(Decimal("0.01"))


def _nested(payload: dict, *keys):
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def loan_payment_amount(*, order: dict, payment: dict) -> Decimal | None:
    """Credit the loan portion only, excluding gateway convenience charges.

    The order is created from the loan payable amount. A gateway payment may
    include an additional customer service charge, which is not loan income.
    Never credit more than either the order or the actual payment amount.
    """
    order_amount = _as_decimal(order.get("order_amount"))
    payment_amount = _as_decimal(payment.get("payment_amount"))
    if order_amount is not None and payment_amount is not None:
        return min(order_amount, payment_amount)
    return order_amount if order_amount is not None else payment_amount


def payment_success_from_webhook(payload: dict) -> dict | None:
    """Return loan id, order id, amount, and utr when Cashfree reports a success."""
    if not isinstance(payload, dict):
        return None
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    order = data.get("order") if isinstance(data.get("order"), dict) else {}
    payment = data.get("payment") if isinstance(data.get("payment"), dict) else {}
    status = str(
        payment.get("payment_status")
        or order.get("transaction_status")
        or data.get("payment_status")
        or ""
    ).upper()
    event = str(payload.get("type") or payload.get("event") or "").upper()
    if status != "SUCCESS" and "SUCCESS" not in event:
        return None
    tags = order.get("order_tags") if isinstance(order.get("order_tags"), dict) else {}
    loan_id = str(tags.get("loan_id") or "").strip()
    order_id = str(order.get("order_id") or data.get("order_id") or "").strip()
    amount = loan_payment_amount(
        order={
            **order,
            "order_amount": order.get("order_amount") or data.get("order_amount"),
        },
        payment=payment,
    )
    if amount is None:
        amount = _as_decimal(data.get("link_amount_paid"))
    utr = str(
        payment.get("cf_payment_id")
        or order.get("transaction_id")
        or payment.get("bank_reference")
        or ""
    ).strip()
    if not loan_id or not order_id or amount is None:
        return None
    return {"loan_id": loan_id, "order_id": order_id, "amount": amount, "utr": utr}


@transaction.atomic
def record_online_payment(
    *, loan_id: str, order_id: str, amount: Decimal, utr: str
) -> LoanRepayment | None:
    """Record one pending collection per Cashfree order.

    The webhook and the browser return both call this. Lock the loan first so
    the second call updates the same row instead of inserting a duplicate.
    """
    order_id = (order_id or "").strip()
    utr = (utr or "").strip()
    if not order_id:
        return None
    try:
        loan = Loan.objects.select_for_update().get(id=loan_id, is_deleted=False)
    except (Loan.DoesNotExist, ValidationError, ValueError):
        logger.info("Cashfree payment for unknown loan %s", loan_id)
        return None
    if loan.status not in OPEN_LOAN_STATUSES:
        logger.info("Cashfree payment ignored for closed loan %s", loan_id)
        return None
    existing = (
        LoanRepayment.objects.select_for_update()
        .filter(loan=loan, gateway_reference=order_id)
        .first()
    )
    if existing is not None:
        update_fields = []
        # A verified retry may correct a pending row recorded before fee
        # separation was introduced. Never rewrite an already posted payment.
        if existing.status == RepaymentStatus.PENDING and existing.amount != amount:
            existing.amount = amount
            update_fields.append("amount")
        if utr and not existing.utr:
            existing.utr = utr
            update_fields.append("utr")
        if update_fields:
            existing.save(update_fields=[*update_fields, "updated_at"])
        return existing
    return LoanRepayment.objects.create(
        loan=loan,
        amount=amount,
        payment_mode=PaymentMode.PAYMENT_LINK,
        utr=utr,
        payment_date=timezone.now(),
        gateway_reference=order_id,
        status=RepaymentStatus.PENDING,
        remarks="Cashfree payment link",
    )


def record_verified_order(order_id: str) -> LoanRepayment | None:
    """Fetch the order and payment from Cashfree, then record the verified amount.

    Used by the webhook and the browser return so neither trusts client- or
    webhook-supplied loan ids or amounts.
    """
    from apps.integrations.cashfree.orders import fetch_order, fetch_successful_payment

    order_id = (order_id or "").strip()
    if not order_id.startswith("rp-"):
        return None
    order = fetch_order(order_id)
    payment = fetch_successful_payment(order_id)
    if payment is None:
        return None
    tags = order.get("order_tags") if isinstance(order.get("order_tags"), dict) else {}
    loan_id = str(tags.get("loan_id") or "").strip()
    amount = loan_payment_amount(order=order, payment=payment)
    if not loan_id or amount is None:
        return None
    return record_online_payment(
        loan_id=loan_id,
        order_id=order_id,
        amount=amount,
        utr=str(payment.get("cf_payment_id") or ""),
    )


def _verified_gateway_amount(repayment: LoanRepayment) -> Decimal | None:
    """Order amount (excluding convenience fee) for a Cashfree collection, or None."""
    from apps.integrations.cashfree.orders import (
        CashfreeOrderError,
        fetch_order,
        fetch_successful_payment,
    )

    order_id = (repayment.gateway_reference or "").strip()
    if not order_id.startswith("rp-"):
        return None
    try:
        order = fetch_order(order_id)
        payment = fetch_successful_payment(order_id)
    except CashfreeOrderError:
        logger.warning("Could not re-check Cashfree order %s; using stored amount", order_id)
        return None
    if payment is None:
        raise RepaymentServiceError("Cashfree does not show a successful payment for this order.")
    return loan_payment_amount(order=order, payment=payment)


@transaction.atomic
def approve_online_payment(*, user, loan: Loan, repayment_id) -> dict:
    try:
        repayment = LoanRepayment.objects.select_for_update().get(id=repayment_id, loan=loan)
    except LoanRepayment.DoesNotExist as exc:
        raise RepaymentServiceError("Collection record not found.") from exc
    if repayment.status == RepaymentStatus.CONFIRMED:
        raise RepaymentServiceError("This payment is already approved.")
    if repayment.status != RepaymentStatus.PENDING:
        raise RepaymentServiceError("This payment cannot be approved.")

    application = loan.application
    if application is None:
        raise RepaymentServiceError("Loan application was not found.")

    # Credit only the loan amount (order amount), never the gateway convenience
    # fee. Older pending rows may hold order + fee, so re-read it from Cashfree.
    verified_amount = _verified_gateway_amount(repayment)
    update_fields = ["status", "updated_by", "updated_at"]
    if verified_amount is not None and verified_amount != repayment.amount:
        logger.info(
            "Correcting Cashfree collection %s from %s to %s (order amount)",
            repayment.id,
            repayment.amount,
            verified_amount,
        )
        repayment.amount = verified_amount
        update_fields.append("amount")

    as_of = LoanCalculationService.to_date(repayment.payment_date) or timezone.localdate()
    metrics = LoanCalculationService.compute_for_application(application, loan=loan, as_of=as_of)
    collected_after = LoanCalculationService.paid_amount_for_loan(loan) + repayment.amount

    # No upper limit (business rule): a payment above the ledger outstanding is
    # posted and leaves the ledger in credit instead of blocking approval.
    repayment.status = RepaymentStatus.CONFIRMED
    repayment.updated_by = user
    repayment.save(update_fields=update_fields)

    try:
        entry = LedgerPostingService.post(
            loan=loan,
            transaction_type=TransactionType.REPAYMENT,
            credit_amount=repayment.amount,
            reference_type="repayment",
            reference_id=repayment.id,
            narration="Repayment via payment link",
            idempotency_key=f"repay-{loan.id}-{repayment.gateway_reference or repayment.id}",
            user=user,
            transaction_date=repayment.payment_date,
            allow_negative=True,
        )
    except LedgerPostingError as exc:
        raise RepaymentServiceError(str(exc)) from exc

    repayment.ledger_entry = entry
    repayment.save(update_fields=["ledger_entry", "updated_at"])

    status_code, status_display = LoanCalculationService.resolve_collection_status(
        amount_due=metrics.amount_due,
        total_collected=collected_after,
        collection_date=as_of,
        disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
        repay_date=LoanCalculationService.resolve_repayment_date(
            application=application, loan=loan
        ),
    )
    outcome = RepaymentService._sync_collection_outcome(
        user=user,
        loan=loan,
        application=application,
        amount_due=metrics.amount_due,
        collected_total=collected_after,
        as_of=as_of,
        status_code=status_code,
        status_display=status_display,
        closing_time=repayment.payment_date,
    )
    return {"repayment": repayment, **outcome}
