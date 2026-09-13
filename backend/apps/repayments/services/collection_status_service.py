from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.repayments.models import RepaymentStatus


def _confirmed_repayments(loan):
    return loan.repayments.filter(status=RepaymentStatus.CONFIRMED).order_by(
        "payment_date", "created_at"
    )


def collection_status_for_repayment(repayment) -> tuple[str, str]:
    loan = repayment.loan
    application = getattr(loan, "application", None)
    if application is None:
        return "part_payment", "Part Payment"

    as_of = LoanCalculationService.to_date(repayment.payment_date) or timezone.localdate()
    collected_upto = Decimal("0")
    for item in _confirmed_repayments(loan):
        collected_upto += item.amount
        if item.id == repayment.id:
            break

    metrics = LoanCalculationService.compute_for_application(
        application,
        loan=loan,
        as_of=as_of,
    )
    return LoanCalculationService.resolve_collection_status(
        amount_due=metrics.amount_due,
        total_collected=collected_upto,
        collection_date=as_of,
        disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
        repay_date=LoanCalculationService.resolve_repayment_date(
            application=application, loan=loan
        ),
    )


def collection_row_for_repayment(repayment) -> dict:
    loan = repayment.loan
    application = getattr(loan, "application", None)
    as_of = LoanCalculationService.to_date(repayment.payment_date) or timezone.localdate()
    collected_before = Decimal("0")
    for item in _confirmed_repayments(loan):
        if item.id == repayment.id:
            break
        collected_before += item.amount

    till_date_amount = "0"
    if application is not None:
        metrics = LoanCalculationService.compute_for_application(
            application,
            loan=loan,
            as_of=as_of,
        )
        metrics_before = LoanCalculationService.compute_summary(
            principal_amount=metrics.principal_amount,
            roi_percent=metrics.roi_percent,
            penalty_rate_percent=LoanCalculationService.resolve_penalty_rate_percent(
                loan=loan,
                application=application,
                disbursal_type=str(
                    (application.disbursal_sheet_details or {}).get("disbursal_type") or ""
                ),
            ),
            disbursal_type=str(
                (application.disbursal_sheet_details or {}).get("disbursal_type") or ""
            ),
            disbursed_at=loan.disbursed_at,
            due_date=LoanCalculationService.resolve_repayment_date(
                application=application, loan=loan
            ),
            contract_tenure_days=metrics.tenure_days,
            paid_amount=collected_before,
            as_of=as_of,
        )
        till_date_amount = str(metrics_before.amount_due)

    status_code, status_display = collection_status_for_repayment(repayment)
    return {
        "id": str(repayment.id),
        "till_date_amount": till_date_amount,
        "collected_amount": str(repayment.amount),
        "penalty_amount": "0",
        "collection_mode": repayment.get_payment_mode_display(),
        "utr_number": repayment.utr,
        "collection_date_time": repayment.payment_date.isoformat()
        if repayment.payment_date
        else "",
        "wave_off": "0",
        "settlement_amount": "0",
        "status": status_code,
        "status_display": status_display,
        "collection_source": repayment.gateway_reference or "",
        "remarks": repayment.remarks,
        "recorded_on": repayment.created_at.isoformat() if repayment.created_at else "",
    }
