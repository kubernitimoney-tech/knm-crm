from decimal import Decimal
from unittest.mock import patch

import pytest
from tests.factories import UserFactory, application_factory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.notifications.services.notification_service import NotificationService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


@pytest.mark.django_db
class TestSanctionRevision:
    def test_revising_approved_amount_updates_application_record(self):
        user = UserFactory()
        _assign_role(user, "admin")
        application = application_factory(customer=customer_factory())
        application.status = ApplicationStatus.APPROVED
        application.approved_amount = Decimal("30000")
        application.save(update_fields=["status", "approved_amount", "updated_at"])

        ApplicationService.decide(
            user=user,
            application=application,
            decision="approved",
            approved_amount=Decimal("25000"),
            approved_tenure_value=30,
            interest_rate=Decimal("24"),
            processing_fee=Decimal("500"),
            sanction_details={"branch": "Delhi", "cibil_score": "750"},
        )

        application.refresh_from_db()
        assert application.status == ApplicationStatus.APPROVED
        assert application.approved_amount == Decimal("25000")

    def test_sanction_email_uses_latest_decision_amount(self):
        user = UserFactory()
        _assign_role(user, "admin")
        application = application_factory(customer=customer_factory())
        application.status = ApplicationStatus.APPROVED
        application.approved_amount = Decimal("30000")
        application.save(update_fields=["status", "approved_amount", "updated_at"])

        ApplicationService.decide(
            user=user,
            application=application,
            decision="approved",
            approved_amount=Decimal("25000"),
            approved_tenure_value=30,
            interest_rate=Decimal("24"),
            processing_fee=Decimal("500"),
            sanction_details={"branch": "Delhi", "cibil_score": "750"},
        )

        captured = {}

        def _capture_email(*, subject, template, context, recipients, cc=None, **_kwargs):
            captured["context"] = context

        with patch.object(
            NotificationService,
            "_send_email_on_commit",
            side_effect=_capture_email,
        ):
            ApplicationService.send_sanction_approved_email(user=user, application=application)

        assert captured["context"]["approved_amount"] == "25,000.00"

    def test_sanction_email_puts_customer_in_to_and_officers_in_cc(self):
        rm = UserFactory(email="rm@example.com")
        cm = UserFactory(email="cm@example.com")
        customer = customer_factory(email="customer@example.com")
        application = application_factory(customer=customer, assigned_rm=rm, assigned_cm=cm)
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["status", "updated_at"])

        captured = {}

        def _capture_email(*, subject, template, context, recipients, cc=None, **_kwargs):
            captured["recipients"] = recipients
            captured["cc"] = cc

        with patch.object(
            NotificationService,
            "_send_email_on_commit",
            side_effect=_capture_email,
        ):
            NotificationService.send_sanction_approved_email(application)

        assert captured["recipients"] == ["customer@example.com"]
        assert set(captured["cc"]) == {"rm@example.com", "cm@example.com"}

    def test_sanction_email_requires_customer_email(self):
        customer = customer_factory()
        type(customer).objects.filter(pk=customer.pk).update(email="")
        customer.refresh_from_db()
        application = application_factory(customer=customer)
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["status", "updated_at"])

        with pytest.raises(ValueError, match="no email address"):
            NotificationService.send_sanction_approved_email(application)

    def test_send_email_on_commit_sends_immediately_via_smtp(self):
        from unittest.mock import patch

        from apps.notifications.services.email_service import EmailService

        sent = {}

        def _record_send(**kwargs):
            sent.update(kwargs)
            return 1

        with patch.object(EmailService, "send_html", side_effect=_record_send):
            with patch("django.db.transaction.on_commit", lambda callback: callback()):
                NotificationService._send_email_on_commit(
                    subject="Test subject",
                    template="sanction_approved",
                    context={"customer_name": "Test"},
                    recipients=["customer@example.com"],
                    cc=["rm@example.com"],
                )

        assert sent["subject"] == "Test subject"
        assert sent["recipients"] == ["customer@example.com"]
        assert sent["cc"] == ["rm@example.com"]
