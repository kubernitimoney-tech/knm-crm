from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from tests.factories import UserFactory, customer_factory

from apps.applications.models import ApplicationStatus
from apps.leads.models import CallDisposition, Lead, LeadSource, LeadStatus
from apps.leads.services.call_log_service import CallLogService
from apps.leads.services.lead_service import LeadService


def _create_lead(*, lead_code: str, customer=None, status=LeadStatus.FRESH) -> Lead:
    customer = customer or customer_factory()
    source, _ = LeadSource.objects.get_or_create(
        slug="web",
        defaults={"name": "Web"},
    )
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        status=status,
    )


class CallLogDispositionStatusTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def test_busy_sets_busy_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-001")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.BUSY)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.BUSY)

    def test_no_answer_keeps_fresh_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-002")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.NO_ANSWER)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_call_back_sets_call_back_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-003")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.CALL_BACK)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.CALL_BACK)

    def test_switched_off_keeps_fresh_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-007")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.SWITCHED_OFF)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_call_disconnected_keeps_fresh_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-008")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.CALL_DISCONNECTED)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_other_keeps_fresh_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-009")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.OTHER)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_busy_overrides_reloan_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-010", status=LeadStatus.RELOAN)
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.BUSY)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.BUSY)

    def test_duplicate_lead_disposition_sets_duplicate_lead_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-004", status=LeadStatus.FRESH)
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.DUPLICATE_LEAD)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.DUPLICATE_LEAD)

    def test_documents_received_disposition_sets_documents_received_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-006")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.DOCUMENTS_RECEIVED)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.DOCUMENTS_RECEIVED)

    def test_documents_pending_disposition_sets_documents_pending_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-013")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.DOCUMENTS_PENDING)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.DOCUMENTS_PENDING)

    def test_interested_disposition_creates_application(self):
        from apps.products.models import LoanProduct

        call_command("seed_products")
        user = UserFactory()
        lead = _create_lead(lead_code="CL-014")
        lead.required_amount = 50000
        lead.interested_product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        lead.save(update_fields=["required_amount", "interested_product", "updated_at"])

        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.INTERESTED)
        lead.refresh_from_db()

        self.assertEqual(lead.status, LeadStatus.INTERESTED)
        self.assertIsNotNone(lead.converted_application_id)
        self.assertEqual(lead.converted_application.status, ApplicationStatus.INTERESTED)

    def test_documents_pending_disposition_creates_incomplete_application(self):
        from apps.products.models import LoanProduct

        call_command("seed_products")
        user = UserFactory()
        lead = _create_lead(lead_code="CL-015")
        lead.required_amount = 50000
        lead.interested_product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        lead.save(update_fields=["required_amount", "interested_product", "updated_at"])

        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.DOCUMENTS_PENDING)
        lead.refresh_from_db()

        self.assertEqual(lead.status, LeadStatus.DOCUMENTS_PENDING)
        self.assertIsNotNone(lead.converted_application_id)
        self.assertEqual(
            lead.converted_application.status,
            ApplicationStatus.DOCUMENTS_INCOMPLETE,
        )

    def test_documents_received_disposition_creates_application(self):
        from apps.products.models import LoanProduct

        call_command("seed_products")
        user = UserFactory()
        lead = _create_lead(lead_code="CL-016")
        lead.required_amount = 50000
        lead.interested_product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        lead.save(update_fields=["required_amount", "interested_product", "updated_at"])

        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.DOCUMENTS_RECEIVED)
        lead.refresh_from_db()

        self.assertEqual(lead.status, LeadStatus.DOCUMENTS_RECEIVED)
        self.assertIsNotNone(lead.converted_application_id)
        self.assertEqual(
            lead.converted_application.status,
            ApplicationStatus.DOCUMENTS_RECEIVED,
        )

    def test_loan_running_disposition_sets_loan_running_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-005", status=LeadStatus.FRESH)
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.LOAN_RUNNING)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.LOAN_RUNNING)

    def test_invalid_number_disposition_sets_invalid_number_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-012")
        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.INVALID_NUMBER)
        lead.refresh_from_db()
        self.assertEqual(lead.status, LeadStatus.INVALID_NUMBER)
        self.assertEqual(lead.close_reason, "")

    def test_call_back_from_not_interested_updates_status(self):
        user = UserFactory()
        lead = _create_lead(lead_code="CL-017", status=LeadStatus.NOT_INTERESTED)
        lead.close_reason = "not_interested"
        lead.save(update_fields=["close_reason", "updated_at"])

        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.CALL_BACK)
        lead.refresh_from_db()

        self.assertEqual(lead.status, LeadStatus.CALL_BACK)
        self.assertEqual(lead.close_reason, "")

    def test_interested_from_not_interested_reopens_rejected_application(self):
        from apps.applications.models import ApplicationStatus, LoanApplication
        from apps.products.models import LoanProduct

        call_command("seed_products")
        user = UserFactory()
        lead = _create_lead(lead_code="CL-018", status=LeadStatus.NOT_INTERESTED)
        lead.rejection_reason = "Low income"
        lead.required_amount = 50000
        lead.interested_product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        lead.save(
            update_fields=[
                "rejection_reason",
                "required_amount",
                "interested_product",
                "updated_at",
            ],
        )
        application = LoanApplication.objects.create(
            application_number="APP-CL018",
            customer=lead.customer,
            lead=lead,
            product=lead.interested_product,
            requested_amount=lead.required_amount,
            tenure_value=30,
            tenure_unit="days",
            status=ApplicationStatus.REJECTED,
            created_by=user,
            updated_by=user,
        )
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        CallLogService.log(user=user, lead=lead, disposition=CallDisposition.INTERESTED)
        lead.refresh_from_db()
        application.refresh_from_db()

        self.assertEqual(lead.status, LeadStatus.INTERESTED)
        self.assertEqual(lead.rejection_reason, "")
        self.assertEqual(application.status, ApplicationStatus.INTERESTED)


class LeadCreationRateLimitTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def test_allows_second_lead_within_hour(self):
        user = UserFactory()
        customer = customer_factory()
        _create_lead(lead_code="RL-001", customer=customer)
        self.assertIsNone(LeadService.check_lead_creation_rate_limit(customer))

    def test_blocks_third_lead_within_hour(self):
        user = UserFactory()
        customer = customer_factory()
        _create_lead(lead_code="RL-002", customer=customer)
        _create_lead(lead_code="RL-003", customer=customer)
        message = LeadService.check_lead_creation_rate_limit(customer)
        self.assertIsNotNone(message)
        self.assertIn("2 leads", message)

    def test_allows_lead_after_hour_window(self):
        customer = customer_factory()
        older = _create_lead(lead_code="RL-004", customer=customer)
        Lead.objects.filter(pk=older.pk).update(
            created_at=timezone.now() - timedelta(hours=2),
        )
        _create_lead(lead_code="RL-005", customer=customer)
        self.assertIsNone(LeadService.check_lead_creation_rate_limit(customer))
