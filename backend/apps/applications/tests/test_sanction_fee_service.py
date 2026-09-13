from decimal import Decimal

from django.test import SimpleTestCase

from apps.applications.services.sanction_fee_service import SanctionFeeService


class SanctionFeeServiceTests(SimpleTestCase):
    def test_compute_example(self):
        result = SanctionFeeService.compute(principal_amount="50000", pf_percentage="10")
        self.assertEqual(result["processing_fee"], "5000.00")
        self.assertEqual(result["gst"], "900.00")
        self.assertEqual(result["pf_percentage"], "10")

    def test_apply_to_sanction_overwrites_client_values(self):
        fee, details = SanctionFeeService.apply_to_sanction(
            approved_amount=Decimal("50000"),
            sanction_details={"pf_percentage": "10", "gst": "1"},
            processing_fee=Decimal("999"),
        )
        self.assertEqual(fee, Decimal("5000.00"))
        self.assertEqual(details["gst"], "900.00")

    def test_apply_to_sanction_reads_legacy_admin_gst_key(self):
        fee, details = SanctionFeeService.apply_to_sanction(
            approved_amount=Decimal("50000"),
            sanction_details={"pf_percentage": "10", "admin_gst": "1"},
            processing_fee=Decimal("999"),
        )
        self.assertEqual(fee, Decimal("5000.00"))
        self.assertEqual(details["gst"], "900.00")
        self.assertNotIn("admin_gst", details)

    def test_compute_net_disbursal_example(self):
        result = SanctionFeeService.compute_net_disbursal(
            principal_amount="50000",
            pf_percentage="10",
        )
        self.assertEqual(result["processing_fee"], "5000.00")
        self.assertEqual(result["gst"], "900.00")
        self.assertEqual(result["total_deduction"], "5900.00")
        self.assertEqual(result["amount_to_be_disbursed"], "44100.00")

    def test_empty_pf_percentage(self):
        result = SanctionFeeService.compute(principal_amount="50000", pf_percentage="")
        self.assertEqual(result["processing_fee"], "0.00")
        self.assertEqual(result["gst"], "0.00")
