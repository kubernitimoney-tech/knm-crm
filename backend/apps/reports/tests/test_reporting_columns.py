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


def test_report_filters_follow_tab_dates(setup):  # noqa: F811
    from rest_framework.test import APIClient

    officer, _lead, loan = setup
    officer.is_superuser = True
    officer.save()
    paid_on = timezone.now() - timedelta(days=2)
    _collect(officer, loan, "100", "UTR-FLT-1", when=paid_on)
    client = APIClient()
    client.force_authenticate(officer)
    disbursed_on = timezone.localtime(loan.disbursed_at).date().isoformat()
    paid_day = timezone.localtime(paid_on).date().isoformat()

    hit = client.get(f"/api/v1/reports/disbursed/?date_from={disbursed_on}&date_to={disbursed_on}")
    assert hit.json()["data"]["count"] == 1
    miss = client.get(f"/api/v1/reports/disbursed/?date_from={paid_day}&date_to={paid_day}")
    assert miss.json()["data"]["count"] == 0

    hit = client.get(f"/api/v1/reports/collection/?date_from={paid_day}&date_to={paid_day}")
    assert hit.json()["data"]["count"] == 1
    miss = client.get(
        f"/api/v1/reports/collection/?date_from={disbursed_on}&date_to={disbursed_on}"
    )
    assert miss.json()["data"]["count"] == 0
    searched = client.get("/api/v1/reports/collection/?search=000001")
    assert searched.json()["data"]["count"] == 1


def test_cash_pending_row_has_new_fields(setup):  # noqa: F811
    from rest_framework.test import APIClient

    officer, _lead, loan = setup
    officer.is_superuser = True
    officer.save()
    _collect(officer, loan, "100", "UTR-CP-1", when=timezone.now() - timedelta(days=1))
    client = APIClient()
    client.force_authenticate(officer)
    row = client.get("/api/v1/loans/pipeline/?stage=cash-pending").json()["data"][0]
    assert row["collected_amount"] == "100.00"
    assert row["repay_amount"] and row["till_date_amount"]
    assert row["customer_type"] == "Fresh"
    assert row["disbursal_date"] == timezone.localtime(loan.disbursed_at).date().isoformat()
