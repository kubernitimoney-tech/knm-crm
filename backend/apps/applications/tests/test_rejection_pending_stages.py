from django.test import TestCase
from tests.factories import UserFactory, application_factory, customer_factory, salary_bank_entries

from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import (
    ApplicationService,
    ApplicationServiceError,
)
from apps.leads.models import Lead, LeadSource, LeadStatus


class TestRejectionFromPendingStages(TestCase):
    def setUp(self):
        self.user = UserFactory(email="reject-pending@test.com")
        customer = customer_factory()
        source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
        self.lead = Lead.objects.create(
            lead_id="LD-REJ-PEND",
            customer=customer,
            source=source,
            status=LeadStatus.INTERESTED,
        )
        self.application = application_factory(customer=customer)
        self.application.lead = self.lead
        self.application.status = ApplicationStatus.DOCUMENTS_INCOMPLETE
        self.application.save(update_fields=["lead", "status", "updated_at"])
        self.lead.converted_application = self.application
        self.lead.save(update_fields=["converted_application", "updated_at"])

    def test_reject_from_documents_incomplete(self):
        result = ApplicationService.decide(
            user=self.user,
            application=self.application,
            decision="rejected",
            rejection_reason="Incomplete Documentation",
            remarks="Bank statement missing",
            sanction_details={"branch": "Mumbai", "cibil_score": "650"},
        )

        self.assertEqual(result.status, ApplicationStatus.REJECTED)
        self.application.refresh_from_db()
        self.lead.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.REJECTED)
        self.assertEqual(self.lead.status, LeadStatus.NOT_INTERESTED)

    def test_reject_from_interested_does_not_advance_to_documents_verified(self):
        self.application.status = ApplicationStatus.INTERESTED
        self.application.save(update_fields=["status", "updated_at"])

        ApplicationService.decide(
            user=self.user,
            application=self.application,
            decision="rejected",
            rejection_reason="Employment Verification Failed",
        )

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.REJECTED)

    def test_approve_from_interested_still_advances_to_documents_verified(self):
        self.application.status = ApplicationStatus.INTERESTED
        self.application.save(update_fields=["status", "updated_at"])

        ApplicationService.decide(
            user=self.user,
            application=self.application,
            decision="approved",
            approved_amount=self.application.requested_amount,
            sanction_details={"salary_banks": salary_bank_entries()},
        )

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.APPROVED)

    def test_reject_blocked_after_disbursed(self):
        self.application.status = ApplicationStatus.DISBURSED
        self.application.save(update_fields=["status", "updated_at"])

        with self.assertRaises(ApplicationServiceError) as ctx:
            ApplicationService.decide(
                user=self.user,
                application=self.application,
                decision="rejected",
                rejection_reason="Other",
            )
        self.assertIn("cannot be rejected", str(ctx.exception))
