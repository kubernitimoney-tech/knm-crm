from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.leads.models import CallDisposition, Lead, LeadCategory, LeadSource, LeadStatus
from apps.leads.serializers import LeadListSerializer
from apps.leads.services.call_log_service import CallLogService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, category=LeadCategory.FRESH) -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        status=LeadStatus.FRESH,
        category=category,
    )


class TestLatestCallDispositionPipeline(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        cls.admin = UserFactory(email="admin-call-pipeline@test.com")
        _assign_role(cls.admin, "admin")

    def test_serializer_exposes_latest_call_disposition(self):
        lead = _create_lead(lead_code="LCD-001")
        CallLogService.log(user=self.admin, lead=lead, disposition=CallDisposition.BUSY)
        CallLogService.log(user=self.admin, lead=lead, disposition=CallDisposition.CALL_BACK)

        data = LeadListSerializer(lead).data
        self.assertEqual(data["latest_call_disposition"], CallDisposition.CALL_BACK)
        self.assertEqual(data["latest_call_disposition_display"], "Call Back")

    def test_lead_detail_api_includes_latest_call_disposition(self):
        lead = _create_lead(lead_code="LCD-002")
        CallLogService.log(user=self.admin, lead=lead, disposition=CallDisposition.BUSY)

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get(reverse("lead-detail", kwargs={"pk": lead.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = (
            response.data["data"]
            if isinstance(response.data, dict) and "data" in response.data
            else response.data
        )
        self.assertEqual(payload["latest_call_disposition"], CallDisposition.BUSY)
        self.assertEqual(payload["latest_call_disposition_display"], "Busy")
        self.assertEqual(payload["status"], LeadStatus.BUSY)

    def test_lead_list_api_includes_latest_call_disposition(self):
        lead = _create_lead(lead_code="LCD-003")
        CallLogService.log(user=self.admin, lead=lead, disposition=CallDisposition.NO_ANSWER)

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get(reverse("lead-list"), {"search": lead.lead_id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(
            item for item in response.data["data"]["results"] if item["lead_id"] == lead.lead_id
        )
        self.assertEqual(row["latest_call_disposition_display"], "No Answer")
