from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APIClient

from apps.loans.models import Loan
from apps.repayments.tests.test_loan_closure_flow import setup  # noqa: F401


def test_bad_snapshot_values_do_not_break_rates(setup):  # noqa: F811
    _officer, _lead, loan = setup
    loan.product_snapshot = {"interest_rate": "1%", "processing_fee": "n/a"}
    loan.save(update_fields=["product_snapshot"])
    loan.refresh_from_db()
    assert str(loan.interest_rate) == "1"
    assert loan.processing_fee is not None


def test_one_bad_loan_does_not_fail_cash_pending(setup):  # noqa: F811
    officer, _lead, loan = setup
    officer.is_superuser = True
    officer.save()
    client = APIClient()
    client.force_authenticate(officer)
    with patch(
        "apps.loans.serializers.loan_pipeline_serializers.LoanPipelineRowSerializer.get_tenure",
        side_effect=ValueError("broken row"),
    ):
        response = client.get("/api/v1/loans/pipeline/?stage=cash-pending")
    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert loan.loan_account_number in body["message"]
    assert Loan.objects.filter(pk=loan.pk, disbursed_at__lte=timezone.now()).exists()
