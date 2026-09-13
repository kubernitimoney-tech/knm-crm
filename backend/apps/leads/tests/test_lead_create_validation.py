from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase
from rest_framework import serializers

from apps.leads.constants import MIN_LEAD_MONTHLY_INCOME
from apps.leads.serializers.lead_serializers import LeadCreateSerializer


def _valid_payload(**overrides):
    data = {
        "first_name": "Test",
        "last_name": "Lead",
        "email": "test.lead@kubernitimoney.com",
        "mobile_number": "9876543210",
        "dob": date(1990, 1, 1),
        "gender": "male",
        "pan_no": "ABCDE1234F",
        "required_amount": Decimal("30000"),
        "loan_purpose": "Personal",
        "employment": {
            "employment_type": "salaried",
            "monthly_salary": Decimal("50000"),
        },
    }
    data.update(overrides)
    return data


class LeadCreateSerializerFinancialValidationTests(SimpleTestCase):
    def test_accepts_valid_income_and_loan_amount(self):
        serializer = LeadCreateSerializer(data=_valid_payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_monthly_income_below_minimum(self):
        serializer = LeadCreateSerializer(
            data=_valid_payload(
                employment={"employment_type": "salaried", "monthly_salary": Decimal("39999")},
            )
        )
        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("monthly_salary", ctx.exception.detail["employment"])

    def test_rejects_required_loan_equal_to_income(self):
        serializer = LeadCreateSerializer(data=_valid_payload(required_amount=Decimal("50000")))
        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("required_amount", ctx.exception.detail)

    def test_rejects_required_loan_greater_than_income(self):
        serializer = LeadCreateSerializer(data=_valid_payload(required_amount=Decimal("60000")))
        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("required_amount", ctx.exception.detail)

    def test_rejects_missing_employment_type(self):
        serializer = LeadCreateSerializer(
            data=_valid_payload(
                employment={"monthly_salary": Decimal("50000")},
            )
        )
        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("employment_type", ctx.exception.detail["employment"])

    def test_rejects_missing_monthly_income(self):
        serializer = LeadCreateSerializer(
            data=_valid_payload(
                employment={"employment_type": "salaried"},
            )
        )
        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("monthly_salary", ctx.exception.detail["employment"])

    def test_minimum_income_constant(self):
        self.assertEqual(MIN_LEAD_MONTHLY_INCOME, Decimal("40000"))
