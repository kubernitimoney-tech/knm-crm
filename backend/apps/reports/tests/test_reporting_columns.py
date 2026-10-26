from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.repayments.tests.test_loan_closure_flow import _collect, setup  # noqa: F401
from apps.reports.services.all_reporting_service import (
    _build_collection_row,
    _build_disbursed_row,
)


def test_disbursed_row_has_new_columns(setup):  # noqa: F811
    _officer, _lead, loan = setup
    row = _build_disbursed_row(loan)
    for key in ("pdType", "disbursedAmount", "ckycNo", "loanType"):
        assert key in row
    assert row["ckycNo"] == ""  # not captured: shown as "-"
    assert row["loanType"] == loan.product.name


def test_collection_row_amounts_and_split_date_time(setup):  # noqa: F811
    officer, _lead, loan = setup
    paid_on = timezone.now() - timedelta(days=2)
    loan.refresh_from_db()
    due = LoanCalculationService.compute_for_application(
        loan.application, loan=loan, as_of=timezone.localtime(paid_on).date()
    ).amount_due
    result = _collect(officer, loan, str(due + Decimal("500")), "UTR-RPT-1", when=paid_on)
    row = _build_collection_row(result["repayment"])
    local = timezone.localtime(paid_on)
    assert row["collectionDate"] == local.strftime("%d-%m-%Y")
    assert row["collectionTime"] == local.strftime("%H:%M:%S")
    assert row["loanAmount"] == "10000.00"
    assert row["repayAmount"] and row["interestAmt"]
    assert row["excessAmount"] == "500.00"
    assert row["waveOff"] == "" and row["settelmentAmt"] == ""
    assert row["repaymentId"] == str(result["repayment"].id)
