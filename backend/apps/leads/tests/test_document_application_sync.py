from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.test import TestCase
from tests.factories import UserFactory, customer_factory

from apps.applications.models import ApplicationStatus, LoanApplication
from apps.applications.services.application_service import ApplicationService
from apps.documents.models import Document, DocumentType
from apps.leads.models import Lead, LeadSource
from apps.leads.services.lead_conversion_service import LeadConversionService


def _create_lead(*, lead_code: str, customer=None) -> Lead:
    customer = customer or customer_factory()
    source, _ = LeadSource.objects.get_or_create(
        slug="web",
        defaults={"name": "Web"},
    )
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
    )


def _create_pending_application(*, user, lead) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.INTERESTED
    application.save(update_fields=["lead", "status"])
    return application


def _create_customer_document(
    *,
    customer,
    is_verified: bool | None = None,
    verification_status: str | None = None,
    code: str = "pan",
) -> Document:
    if verification_status is None:
        verification_status = "verified" if is_verified else "unverified"
    document_type, _ = DocumentType.objects.get_or_create(
        code=code,
        defaults={"name": code.upper()},
    )
    content_type = ContentType.objects.get_for_model(customer)
    return Document.objects.create(
        content_type=content_type,
        object_id=customer.pk,
        document_type=document_type,
        is_verified=verification_status == "verified",
        verification_status=verification_status,
    )


class DocumentApplicationStatusSyncTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_unverified_document_sets_documents_incomplete(self):
        user = UserFactory()
        lead = _create_lead(lead_code="LD-DOC-001")
        application = _create_pending_application(user=user, lead=lead)
        _create_customer_document(customer=lead.customer, is_verified=False)

        LeadConversionService.sync_application_from_customer_documents(user=user, lead=lead)

        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.DOCUMENTS_INCOMPLETE)

    def test_all_verified_documents_sets_documents_verified(self):
        user = UserFactory()
        lead = _create_lead(lead_code="LD-DOC-002")
        application = _create_pending_application(user=user, lead=lead)
        _create_customer_document(customer=lead.customer, is_verified=True)

        LeadConversionService.sync_application_from_customer_documents(user=user, lead=lead)

        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.DOCUMENTS_VERIFIED)

    def test_no_documents_keeps_interested(self):
        user = UserFactory()
        lead = _create_lead(lead_code="LD-DOC-003")
        application = _create_pending_application(user=user, lead=lead)

        LeadConversionService.sync_application_from_customer_documents(user=user, lead=lead)

        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.INTERESTED)

    def test_mixed_documents_stays_incomplete(self):
        user = UserFactory()
        lead = _create_lead(lead_code="LD-DOC-004")
        application = _create_pending_application(user=user, lead=lead)
        _create_customer_document(customer=lead.customer, is_verified=True, code="pan")
        _create_customer_document(customer=lead.customer, is_verified=False, code="aadhaar")

        LeadConversionService.sync_application_from_customer_documents(user=user, lead=lead)

        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.DOCUMENTS_INCOMPLETE)

    def test_incomplete_document_sets_documents_incomplete(self):
        user = UserFactory()
        lead = _create_lead(lead_code="LD-DOC-005")
        application = _create_pending_application(user=user, lead=lead)
        _create_customer_document(customer=lead.customer, verification_status="incomplete")

        LeadConversionService.sync_application_from_customer_documents(user=user, lead=lead)

        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.DOCUMENTS_INCOMPLETE)
