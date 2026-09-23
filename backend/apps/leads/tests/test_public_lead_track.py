from decimal import Decimal

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import customer_factory

from apps.leads.models import Lead, LeadCategory, LeadSource, LeadStatus


class PublicLeadTrackAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.source, _ = LeadSource.objects.get_or_create(
            slug="website", defaults={"name": "Website"}
        )
        self.customer = customer_factory(
            email="track.customer@example.com",
            mobile_number="9999999999",
            pan_no="ABCDE1234F",
        )

    def _create_lead(self, lead_id: str, *, status: str, category: str = LeadCategory.FRESH):
        return Lead.objects.create(
            lead_id=lead_id,
            customer=self.customer,
            source=self.source,
            status=status,
            category=category,
            required_amount=Decimal("10000"),
        )

    def test_track_by_mobile_lists_all_newest_first_with_latest_badge(self):
        self._create_lead("LMS000002", status=LeadStatus.CLOSED)
        self._create_lead("LMS000004", status=LeadStatus.SETTLEMENT)
        self._create_lead("LMS000006", status=LeadStatus.PAYDAY_PRE_CLOSE)
        self._create_lead("LMS000008", status=LeadStatus.PART_PAYMENT)
        self._create_lead(
            "LMS000010",
            status=LeadStatus.RELOAN,
            category=LeadCategory.RELOAN,
        )

        response = self.client.post(
            reverse("lead-public-track"),
            {"mobile_number": "9999999999"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertTrue(data["found"])
        refs = [row["reference_id"] for row in data["applications"]]
        self.assertEqual(refs, ["LMS000010", "LMS000008", "LMS000006", "LMS000004", "LMS000002"])
        self.assertTrue(data["applications"][0]["is_latest"])
        self.assertFalse(data["applications"][1]["is_latest"])
        self.assertEqual(data["applications"][0]["status"], LeadStatus.RELOAN)
        self.assertEqual(data["applications"][0]["status_display"], "Reloan enquiry")
        self.assertEqual(data["applications"][0]["title"], "Reloan enquiry")
        self.assertEqual(data["applications"][1]["status_display"], "Part payment")
        self.assertEqual(data["applications"][2]["status_display"], "Pre-closed")
        self.assertEqual(data["applications"][3]["status_display"], "Settled")
        self.assertEqual(data["applications"][4]["status_display"], "Closed")

    def test_track_title_uses_loan_purpose(self):
        Lead.objects.create(
            lead_id="LMS000200",
            customer=self.customer,
            source=self.source,
            status=LeadStatus.FRESH,
            category=LeadCategory.FRESH,
            required_amount=Decimal("25000"),
            loan_purpose="Personal",
        )
        response = self.client.post(
            reverse("lead-public-track"),
            {"mobile_number": "9999999999"},
            format="json",
        )
        app = response.data["data"]["applications"][0]
        self.assertEqual(app["title"], "Personal enquiry")
        self.assertEqual(app["required_amount"], "25000.00")
        self.assertEqual(app["status_display"], "Application received")

    def test_track_by_pan(self):
        self._create_lead("LMS000100", status=LeadStatus.FRESH)
        response = self.client.post(
            reverse("lead-public-track"),
            {"pan_no": "ABCDE1234F"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["data"]["found"])
        self.assertEqual(response.data["data"]["applications"][0]["reference_id"], "LMS000100")
        self.assertEqual(response.data["data"]["applications"][0]["title"], "Loan enquiry")

    def test_not_found_returns_empty_list(self):
        response = self.client.post(
            reverse("lead-public-track"),
            {"mobile_number": "9000000001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["data"]["found"])
        self.assertEqual(response.data["data"]["applications"], [])

    def test_requires_pan_or_mobile(self):
        response = self.client.post(reverse("lead-public-track"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
