import uuid

import pytest
from tests.factories import UserFactory, application_factory, customer_factory, grant_permission

from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import (
    ApplicationService,
    ApplicationServiceError,
)
from apps.leads.models import Lead, LeadSource, LeadStatus
from apps.loans.services.loan_service import LoanService


def _application_with_lead():
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    lead = Lead.objects.create(
        lead_id=f"LD-{uuid.uuid4().hex[:8].upper()}",
        customer=customer,
        source=source,
        status=LeadStatus.LOAN_RUNNING,
    )
    application = application_factory(customer=customer)
    application.lead = lead
    application.save(update_fields=["lead", "updated_at"])
    lead.converted_application = application
    lead.save(update_fields=["converted_application", "updated_at"])
    return application, lead


@pytest.mark.django_db
class TestPostSanctionRejection:
    def test_reject_after_sanction_approved(self):
        user = UserFactory()
        grant_permission(user, "application.reject")
        application, _lead = _application_with_lead()
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["status"])
        LoanService.create_from_application(user=user, application=application)

        result = ApplicationService.decide(
            user=user,
            application=application,
            decision="rejected",
            rejection_reason="Low CIBIL Score",
            remarks="Post-sanction review",
            sanction_details={"branch": "Mumbai", "cibil_score": "620"},
        )

        assert result.status == ApplicationStatus.REJECTED
        application.refresh_from_db()
        application.loan.refresh_from_db()
        assert application.loan.is_deleted is True
        assert application.lead.status == LeadStatus.NOT_INTERESTED

    def test_reject_after_disbursal_sheet_sent(self):
        user = UserFactory()
        grant_permission(user, "application.reject")
        application, _lead = _application_with_lead()
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["status"])
        LoanService.create_from_application(user=user, application=application)
        application.status = ApplicationStatus.DISBURSAL_SHEET_SENT
        application.disbursal_sheet_details = {"cheque_no": "123456"}
        application.save(update_fields=["status", "disbursal_sheet_details"])

        result = ApplicationService.decide(
            user=user,
            application=application,
            decision="rejected",
            rejection_reason="Customer Withdrawal",
            remarks="Customer declined disbursal",
            sanction_details={"branch": "Delhi", "cibil_score": "700"},
        )

        assert result.status == ApplicationStatus.REJECTED

    def test_reject_blocked_after_disbursed(self):
        user = UserFactory()
        application = application_factory()
        application.status = ApplicationStatus.DISBURSED
        application.save(update_fields=["status"])

        with pytest.raises(ApplicationServiceError, match="cannot be rejected"):
            ApplicationService.decide(
                user=user,
                application=application,
                decision="rejected",
                rejection_reason="Other",
            )
