from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import customer_factory

from apps.leads.models import Lead, LeadCategory, LeadSource, LeadStatus


class PublicLeadIntakeAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def setUp(self):
        self.client = APIClient()

    def _payload(self, **overrides):
        base = {
            "first_name": "Asha",
            "last_name": "Verma",
            "email": "asha.public.intake@example.com",
            "mobile_number": "9876543210",
            "required_amount": "25000",
            "source_slug": "website",
            "employment": {
                "employment_type": "salaried",
                "monthly_salary": "50000",
            },
        }
        base.update(overrides)
        return base

    def test_create_lead_without_authentication(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(mobile_number="9876500001", email="website.lead@example.com"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        lead_id = response.data["data"]["lead_id"]
        lead = Lead.objects.get(lead_id=lead_id)
        self.assertEqual(lead.status, LeadStatus.FRESH)
        self.assertEqual(lead.category, LeadCategory.FRESH)
        self.assertEqual(lead.source.slug, "website")

    def test_social_media_source_slug(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500002",
                email="social.lead@example.com",
                source_slug="social-media",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get(lead_id=response.data["data"]["lead_id"])
        self.assertEqual(lead.source.slug, "social-media")
        self.assertEqual(lead.source.name, "Social Media")

    def test_ads_source_slug(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500003",
                email="ads.lead@example.com",
                source_slug="ads",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get(lead_id=response.data["data"]["lead_id"])
        self.assertEqual(lead.source.slug, "ads")

    def test_second_lead_stays_fresh_for_returning_customer_without_disbursal(self):
        customer = customer_factory(
            email="returning.public@example.com",
            mobile_number="9876500004",
        )
        source, _ = LeadSource.objects.get_or_create(slug="website", defaults={"name": "Website"})
        Lead.objects.create(
            lead_id="PRIOR-PUBLIC-001",
            customer=customer,
            source=source,
            status=LeadStatus.FRESH,
            category=LeadCategory.FRESH,
            required_amount=Decimal("10000"),
        )
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500004",
                email="returning.public@example.com",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["category"], LeadCategory.FRESH)
        lead = Lead.objects.get(lead_id=response.data["data"]["lead_id"])
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_public_sources_list_without_authentication(self):
        response = self.client.get(reverse("lead-public-intake-sources"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in response.data["data"]}
        self.assertEqual(slugs, {"website", "social-media", "ads"})

    def test_rejects_monthly_income_below_minimum(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500010",
                email="low.income@example.com",
                employment={"employment_type": "salaried", "monthly_salary": "39999"},
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("monthly_salary", response.data["errors"]["employment"])

    def test_rejects_required_loan_greater_than_income(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500011",
                email="high.loan@example.com",
                required_amount="60000",
                employment={"employment_type": "salaried", "monthly_salary": "50000"},
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_amount", response.data["errors"])

    def test_rejects_missing_employment_type(self):
        response = self.client.post(
            reverse("lead-public-intake"),
            self._payload(
                mobile_number="9876500012",
                email="no.employment.type@example.com",
                employment={"monthly_salary": "50000"},
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("employment_type", response.data["errors"]["employment"])
