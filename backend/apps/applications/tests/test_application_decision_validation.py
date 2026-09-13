from decimal import Decimal

import pytest

from apps.applications.serializers.application_serializers import ApplicationDecisionWriteSerializer


@pytest.mark.parametrize(
    ("approved_amount", "monthly_income", "monthly_obligation", "error"),
    [
        (Decimal("50000"), "60000", "10000", None),
        (Decimal("60000"), "60000", "0", "Loan amount must be less than monthly income."),
        (Decimal("70000"), "60000", "0", "Loan amount must be less than monthly income."),
        (Decimal("50000"), "0", "0", "Monthly income must be a positive number."),
        (Decimal("50000"), "", "0", "Monthly income must be a positive number."),
        (
            Decimal("50000"),
            "60000",
            "60000",
            "Monthly obligation must be less than monthly income.",
        ),
        (
            Decimal("50000"),
            "60000",
            "65000",
            "Monthly obligation must be less than monthly income.",
        ),
    ],
)
def test_approved_decision_validates_income_limits(
    approved_amount,
    monthly_income,
    monthly_obligation,
    error,
):
    serializer = ApplicationDecisionWriteSerializer(
        data={
            "decision": "approved",
            "approved_amount": approved_amount,
            "sanction_details": {
                "monthly_income": monthly_income,
                "monthly_obligation": monthly_obligation,
                "cibil_score": "750",
            },
        }
    )

    if error:
        assert not serializer.is_valid()
        assert error in str(serializer.errors)
    else:
        assert serializer.is_valid(), serializer.errors
