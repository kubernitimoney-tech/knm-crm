from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory, grant_permission

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.documents.models import DocumentType
from apps.leads.models import Lead, LeadSource


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead_with_application(*, lead_code: str, rm, cm):
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    lead = Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_rm=rm,
        assigned_cm=cm,
    )
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=rm,
        customer=customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.INTERESTED
    application.save(update_fields=["lead", "status"])
    return application


class DocumentUploadAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")
        DocumentType.objects.get_or_create(
            code="pan",
            defaults={"name": "PAN Card", "is_required": True},
        )

    def test_assigned_cm_can_upload_to_own_application(self):
        rm = UserFactory(email="rm-doc-upload@test.com")
        cm = UserFactory(email="cm-doc-upload@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        application = _create_lead_with_application(lead_code="LD-DOC-01", rm=rm, cm=cm)
        upload_file = SimpleUploadedFile("pan.pdf", b"pdf-content", content_type="application/pdf")

        client = APIClient()
        client.force_authenticate(user=cm)
        response = client.post(
            f"/api/v1/documents/upload/{application.id}/",
            {"document_type": "pan", "file": upload_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unrelated_user_cannot_upload_to_foreign_application(self):
        rm = UserFactory(email="rm-doc-block@test.com")
        cm = UserFactory(email="cm-doc-block@test.com")
        outsider = UserFactory(email="outsider-doc-block@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        grant_permission(outsider, "document.upload")

        application = _create_lead_with_application(lead_code="LD-DOC-02", rm=rm, cm=cm)
        upload_file = SimpleUploadedFile("pan.pdf", b"pdf-content", content_type="application/pdf")

        client = APIClient()
        client.force_authenticate(user=outsider)
        response = client.post(
            f"/api/v1/documents/upload/{application.id}/",
            {"document_type": "pan", "file": upload_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
