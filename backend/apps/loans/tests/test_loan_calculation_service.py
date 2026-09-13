from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from apps.loans.services.loan_calculation_service import LoanCalculationService


class LoanCalculationServiceTests(SimpleTestCase):
    def test_tenure_days_user_example(self):
        tenure = LoanCalculationService.tenure_days(
            disbursal_date=date(2026, 6, 30),
            due_date=date(2026, 8, 4),
        )
        self.assertEqual(tenure, 35)

    def test_contract_tenure_waterfall_examples(self):
        repayment = date(2026, 7, 31)

        self.assertEqual(
            LoanCalculationService.compute_contract_tenure_days(
                repayment_date=repayment,
                sanction_date=date(2026, 6, 29),
            ),
            32,
        )
        self.assertEqual(
            LoanCalculationService.compute_contract_tenure_days(
                repayment_date=repayment,
                disbursal_sheet_sent_date=date(2026, 6, 30),
                sanction_date=date(2026, 6, 29),
            ),
            31,
        )
        self.assertEqual(
            LoanCalculationService.compute_contract_tenure_days(
                repayment_date=repayment,
                disbursal_date=date(2026, 7, 1),
                disbursal_sheet_sent_date=date(2026, 6, 30),
                sanction_date=date(2026, 6, 29),
            ),
            30,
        )

    def test_real_days_and_interest_examples(self):
        principal = Decimal("100000")
        roi = Decimal("1")
        repayment = date(2026, 7, 31)
        disbursal = date(2026, 7, 1)

        on_disbursal_day = LoanCalculationService.compute_summary(
            principal_amount=principal,
            roi_percent=roi,
            disbursed_at=disbursal,
            due_date=repayment,
            contract_tenure_days=30,
            as_of=date(2026, 7, 1),
        )
        self.assertEqual(on_disbursal_day.real_days, 0)
        self.assertEqual(on_disbursal_day.real_interest, Decimal("0"))
        self.assertEqual(on_disbursal_day.till_date_amount, Decimal("100000"))

        after_one_day = LoanCalculationService.compute_summary(
            principal_amount=principal,
            roi_percent=roi,
            disbursed_at=disbursal,
            due_date=repayment,
            contract_tenure_days=30,
            as_of=date(2026, 7, 2),
        )
        self.assertEqual(after_one_day.real_days, 1)
        self.assertEqual(after_one_day.real_interest, Decimal("1000"))
        self.assertEqual(after_one_day.till_date_amount, Decimal("101000"))

        on_repayment_day = LoanCalculationService.compute_summary(
            principal_amount=principal,
            roi_percent=roi,
            disbursed_at=disbursal,
            due_date=repayment,
            contract_tenure_days=30,
            as_of=date(2026, 7, 31),
        )
        self.assertEqual(on_repayment_day.real_days, 30)
        self.assertEqual(on_repayment_day.real_interest, Decimal("30000"))
        self.assertEqual(on_repayment_day.penalty_days, 0)
        self.assertEqual(on_repayment_day.till_date_amount, Decimal("130000"))

    def test_penalty_interest_example(self):
        principal = Decimal("100000")
        roi = Decimal("1")
        penalty_rate = Decimal("0.25")
        repayment = date(2026, 7, 31)
        disbursal = date(2026, 7, 1)

        after_repayment = LoanCalculationService.compute_summary(
            principal_amount=principal,
            roi_percent=roi,
            penalty_rate_percent=penalty_rate,
            disbursed_at=disbursal,
            due_date=repayment,
            contract_tenure_days=30,
            as_of=date(2026, 8, 1),
        )
        self.assertEqual(after_repayment.real_days, 31)
        self.assertEqual(after_repayment.real_interest, Decimal("31000"))
        self.assertEqual(after_repayment.penalty_days, 1)
        self.assertEqual(after_repayment.penalty_interest, Decimal("250"))
        self.assertEqual(after_repayment.till_date_amount, Decimal("131250"))

    def test_payday_overdue_example_000051(self):
        """Principal 33000 @ 1%/day, tenure 8, real days 15 → penalty 7 days @ 0.25%/day."""
        principal = Decimal("33000")
        roi = Decimal("1")
        penalty_rate = Decimal("0.25")
        disbursal = date(2026, 7, 1)
        due = date(2026, 7, 9)  # 8-day tenure

        metrics = LoanCalculationService.compute_summary(
            principal_amount=principal,
            roi_percent=roi,
            penalty_rate_percent=penalty_rate,
            disbursed_at=disbursal,
            due_date=due,
            contract_tenure_days=8,
            as_of=date(2026, 7, 16),  # 15 elapsed days
        )
        self.assertEqual(metrics.real_days, 15)
        self.assertEqual(metrics.tenure_days, 8)
        self.assertEqual(metrics.daily_interest, Decimal("330"))
        self.assertEqual(metrics.real_interest, Decimal("4950"))
        self.assertEqual(metrics.penalty_days, 7)
        self.assertEqual(metrics.penalty_interest, Decimal("577.50"))
        self.assertEqual(metrics.till_date_amount, Decimal("38527.50"))

    def test_default_penalty_rate_for_payday_product(self):
        metrics = LoanCalculationService.compute_summary(
            principal_amount=Decimal("33000"),
            roi_percent=Decimal("1"),
            penalty_rate_percent=Decimal("0.25"),
            disbursed_at=date(2026, 7, 1),
            due_date=date(2026, 7, 9),
            contract_tenure_days=8,
            as_of=date(2026, 7, 16),
        )
        self.assertEqual(metrics.penalty_interest, Decimal("577.50"))

    def test_snapshot_zero_penalty_falls_back_to_product_rate(self):
        from unittest.mock import Mock

        product = Mock()
        product.penalty_rate = Decimal("0.25")
        product.product_code = "PAYDAY"
        product.tenure_unit = "days"
        product.interest_type = "flat"
        loan = Mock(product_snapshot={"penalty_rate": "0.0000"}, product=product, product_id=True)
        rate = LoanCalculationService.resolve_penalty_rate_percent(loan=loan)
        self.assertEqual(rate, Decimal("0.25"))

    def test_contract_repay_amount(self):
        metrics = LoanCalculationService.compute_summary(
            principal_amount=Decimal("100000"),
            roi_percent=Decimal("1"),
            disbursed_at=date(2026, 7, 1),
            due_date=date(2026, 7, 31),
            contract_tenure_days=30,
            as_of=date(2026, 7, 1),
        )
        self.assertEqual(metrics.repay_amount, Decimal("130000"))

    def test_paid_amount_reduces_till_date_amount(self):
        metrics = LoanCalculationService.compute_summary(
            principal_amount=Decimal("50000"),
            roi_percent=Decimal("1"),
            disbursed_at=date(2026, 6, 20),
            due_date=date(2026, 7, 30),
            paid_amount=Decimal("1000"),
            as_of=date(2026, 6, 21),
        )
        self.assertEqual(metrics.till_date_amount, Decimal("49500"))

    def test_resolve_collection_status_part_payment(self):
        code, label = LoanCalculationService.resolve_collection_status(
            amount_due=Decimal("109000"),
            total_collected=Decimal("50000"),
        )
        self.assertEqual(code, "part_payment")
        self.assertEqual(label, "Part Payment")

    def test_resolve_collection_status_close(self):
        code, label = LoanCalculationService.resolve_collection_status(
            amount_due=Decimal("109000"),
            total_collected=Decimal("109000"),
            collection_date=date(2026, 7, 30),
            repay_date=date(2026, 7, 30),
        )
        self.assertEqual(code, "close")
        self.assertEqual(label, "Closed")

    def test_resolve_collection_status_payday_pre_close(self):
        code, label = LoanCalculationService.resolve_collection_status(
            amount_due=Decimal("100000"),
            total_collected=Decimal("100000"),
            collection_date=date(2026, 7, 15),
            repay_date=date(2026, 7, 30),
        )
        self.assertEqual(code, "payday_pre_close")
        self.assertEqual(label, "Payday Pre-Close")

    def test_allowed_collection_status_before_repay_date(self):
        allowed = LoanCalculationService.allowed_collection_status_codes(
            collection_date=date(2026, 7, 15),
            repay_date=date(2026, 7, 30),
        )
        self.assertEqual(allowed, frozenset({"part_payment", "payday_pre_close"}))

    def test_allowed_collection_status_on_or_after_repay_date(self):
        allowed = LoanCalculationService.allowed_collection_status_codes(
            collection_date=date(2026, 7, 30),
            repay_date=date(2026, 7, 30),
        )
        self.assertEqual(allowed, frozenset({"close", "settlement", "part_payment"}))
