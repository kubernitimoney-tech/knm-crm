from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus, LoanApplication
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource, LeadStatus
from apps.loans.models import Loan, LoanStatus
from apps.notifications.models import Notification
from apps.notifications.services.loan_notification_service import LoanNotificationService
from apps.notifications.services.notification_service import NotificationService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, customer, rm, cm) -> Lead:
    source, _ = LeadSource.objects.get_or_create(
        slug="website",
        defaults={"name": "Website"},
    )
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_rm=rm,
        assigned_cm=cm,
        status=LeadStatus.FRESH,
        required_amount=Decimal("25000"),
    )


def _create_application(
    *, customer, lead, cm=None, status=ApplicationStatus.DOCUMENTS_VERIFIED
) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    return LoanApplication.objects.create(
        application_number=f"APP-{lead.lead_id}",
        customer=customer,
        product=product,
        lead=lead,
        assigned_cm=cm,
        requested_amount=Decimal("50000"),
        tenure_value=30,
        tenure_unit=product.tenure_unit,
        status=status,
    )


def _create_loan(*, application, due_date: date) -> Loan:
    loan = Loan.objects.create(
        loan_account_number=f"LN-{application.application_number}",
        application=application,
        customer=application.customer,
        product=application.product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=due_date,
        status=LoanStatus.ACTIVE,
        disbursed_at=timezone.now(),
    )
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["status"])
    return loan


class NotificationEventTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_public_intake_notifies_assigned_rm_and_cm(self):
        rm = UserFactory(email="rm.notify@example.com")
        cm = UserFactory(email="cm.notify@example.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        client = APIClient()
        response = client.post(
            reverse("lead-public-intake"),
            {
                "first_name": "Notify",
                "last_name": "Lead",
                "email": "notify.lead@example.com",
                "mobile_number": "9876511111",
                "required_amount": "30000",
                "source_slug": "website",
                "employment": {
                    "employment_type": "salaried",
                    "monthly_salary": "50000",
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        lead = Lead.objects.get(lead_id=response.data["data"]["lead_id"])
        self.assertIsNotNone(lead.assigned_rm_id)
        self.assertIsNotNone(lead.assigned_cm_id)

        rm_notes = Notification.objects.filter(recipient_id=lead.assigned_rm_id)
        cm_notes = Notification.objects.filter(recipient_id=lead.assigned_cm_id)
        self.assertEqual(rm_notes.count(), 1)
        self.assertEqual(cm_notes.count(), 1)
        self.assertIn("New lead from Website", rm_notes.first().title)
        self.assertEqual(
            rm_notes.first().metadata.get("event_type"),
            NotificationService.EVENT_LEAD_INTAKE,
        )

    def test_application_approved_notifies_production_manager(self):
        pm = UserFactory(email="pm.notify@example.com")
        _assign_role(pm, "production-manager")
        approver = UserFactory(email="approver@example.com")
        _assign_role(approver, "admin")

        customer = customer_factory()
        rm = UserFactory(email="rm2@example.com")
        cm = UserFactory(email="cm2@example.com")
        lead = _create_lead(lead_code="NTF-001", customer=customer, rm=rm, cm=cm)
        application = _create_application(customer=customer, lead=lead, cm=cm)

        ApplicationService.decide(
            user=approver,
            application=application,
            decision="approved",
            approved_amount=Decimal("50000"),
            approved_tenure_value=30,
            interest_rate=Decimal("1"),
            processing_fee=Decimal("1000"),
        )

        notes = Notification.objects.filter(recipient=pm)
        self.assertEqual(notes.count(), 1)
        self.assertIn("Application approved", notes.first().title)
        self.assertEqual(
            notes.first().metadata.get("event_type"),
            NotificationService.EVENT_APPLICATION_APPROVED,
        )

    def test_application_approved_sends_sanction_email(self):
        approver = UserFactory(email="approver.mail@example.com")
        _assign_role(approver, "admin")
        customer = customer_factory(email="sanction.borrower@example.com")
        rm = UserFactory(email="rm.sanction@example.com")
        cm = UserFactory(email="cm.sanction@example.com")
        lead = _create_lead(lead_code="NTF-SANC", customer=customer, rm=rm, cm=cm)
        application = _create_application(customer=customer, lead=lead, cm=cm)

        with patch.object(NotificationService, "send_sanction_approved_email") as send_email:
            ApplicationService.decide(
                user=approver,
                application=application,
                decision="approved",
                approved_amount=Decimal("50000"),
                approved_tenure_value=30,
                interest_rate=Decimal("1"),
                processing_fee=Decimal("1000"),
            )

        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], application)
        self.assertFalse(send_email.call_args.kwargs["raise_on_error"])

    def test_disbursal_sheet_sent_notifies_account_finance(self):
        from unittest.mock import patch

        account_user = UserFactory(email="accounts.notify@example.com")
        _assign_role(account_user, "account-finance")
        submitter = UserFactory(email="cm.submit@example.com")
        _assign_role(submitter, "credit-manager")

        customer = customer_factory()
        rm = UserFactory(email="rm3@example.com")
        cm = UserFactory(email="cm3@example.com")
        lead = _create_lead(lead_code="NTF-002", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )

        with patch(
            "apps.applications.services.application_service.apply_ifsc_bank_details",
            side_effect=lambda details: details,
        ):
            ApplicationService.submit_disbursal_sheet(
                user=submitter,
                application=application,
                disbursal_details={
                    "account_number": "123456789012",
                    "ifsc_code": "HDFC0001234",
                    "account_holder_name": "Test Customer",
                    "cheque_no": "CHQ123456",
                },
            )

        notes = Notification.objects.filter(recipient=account_user)
        self.assertEqual(notes.count(), 1)
        self.assertIn("Disbursal sheet sent", notes.first().title)
        self.assertEqual(
            notes.first().metadata.get("event_type"),
            NotificationService.EVENT_DISBURSAL_SHEET_SENT,
        )

    def test_disbursal_sheet_sent_does_not_email_customer(self):
        from unittest.mock import patch

        submitter = UserFactory(email="cm.submit@example.com")
        _assign_role(submitter, "credit-manager")
        customer = customer_factory(email="borrower@example.com")
        rm = UserFactory(email="rm3@example.com")
        cm = UserFactory(email="cm3@example.com")
        lead = _create_lead(lead_code="NTF-002B", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )

        with (
            patch(
                "apps.applications.services.application_service.apply_ifsc_bank_details",
                side_effect=lambda details: details,
            ),
            patch.object(NotificationService, "_send_email_on_commit") as send_email,
        ):
            ApplicationService.submit_disbursal_sheet(
                user=submitter,
                application=application,
                disbursal_details={
                    "account_number": "123456789012",
                    "ifsc_code": "HDFC0001234",
                    "account_holder_name": "Test Customer",
                    "cheque_no": "CHQ123456",
                },
            )

        send_email.assert_not_called()

    def test_loan_disbursed_email_to_customer_cc_confirmation(self):
        customer = customer_factory(
            email="rohit.dhingra200@gmail.com",
            first_name="Rohit",
            last_name="Dhingra",
        )
        rm = UserFactory(email="rm.disburse@example.com")
        cm = UserFactory(email="cm.disburse@example.com")
        lead = _create_lead(lead_code="NTF-DISB", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )
        application.requested_amount = Decimal("40000")
        application.save(update_fields=["requested_amount"])
        loan = Loan.objects.create(
            loan_account_number="LDR573689062731",
            application=application,
            customer=customer,
            product=application.product,
            principal_amount=Decimal("40000"),
            interest_amount=Decimal("13200"),
            total_repayable=Decimal("53200"),
            product_snapshot={"interest_rate": "1"},
            due_date=date(2026, 8, 3),
            status=LoanStatus.ACTIVE,
            disbursed_at=timezone.make_aware(datetime(2026, 7, 1, 10, 0, 0)),
        )

        captured = {}

        def _capture_email(
            *, subject, template, context, recipients, cc=None, from_email=None, **_kwargs
        ):
            captured.update(
                {
                    "subject": subject,
                    "template": template,
                    "context": context,
                    "recipients": recipients,
                    "cc": cc,
                    "from_email": from_email,
                }
            )

        with patch.object(
            NotificationService,
            "_send_email_on_commit",
            side_effect=_capture_email,
        ):
            NotificationService.send_loan_disbursed_email(loan=loan, application=application)

        self.assertEqual(captured["subject"], "Kuberniti Money - Loan Disbursed")
        self.assertEqual(captured["template"], "loan_disbursed")
        self.assertEqual(captured["recipients"], ["rohit.dhingra200@gmail.com"])
        self.assertEqual(captured["cc"], ["confirmation@kubernitimoney.com"])
        self.assertIn("disbursal@kubernitimoney.com", captured["from_email"])
        self.assertNotIn("rm.disburse@example.com", captured["cc"])
        self.assertNotIn("cm.disburse@example.com", captured["cc"])
        self.assertEqual(captured["context"]["loan_number"], "LDR573689062731")
        self.assertEqual(captured["context"]["principal_amount"], "40,000")
        self.assertEqual(captured["context"]["interest_rate"], "1%")
        self.assertEqual(captured["context"]["tenure_days"], "33")
        self.assertEqual(captured["context"]["repayment_amount"], "53,200")
        self.assertEqual(
            captured["context"]["repayment_amount_words"],
            "Fifty-Three Thousand Two Hundred",
        )
        self.assertIn("Rohit", captured["context"]["customer_name"])

    def test_loan_disbursed_email_skipped_without_customer_email(self):
        customer = customer_factory()
        type(customer).objects.filter(pk=customer.pk).update(email="")
        customer.refresh_from_db()
        rm = UserFactory(email="rm.skip@example.com")
        cm = UserFactory(email="cm.skip@example.com")
        lead = _create_lead(lead_code="NTF-SKIP", customer=customer, rm=rm, cm=cm)
        application = _create_application(customer=customer, lead=lead, cm=cm)
        loan = Loan.objects.create(
            loan_account_number="LN-SKIP-EMAIL",
            application=application,
            customer=customer,
            product=application.product,
            principal_amount=Decimal("10000"),
            total_repayable=Decimal("10000"),
            due_date=timezone.localdate() + timedelta(days=15),
            status=LoanStatus.ACTIVE,
        )

        with patch.object(NotificationService, "_send_email_on_commit") as send_email:
            NotificationService.send_loan_disbursed_email(loan=loan, application=application)

        send_email.assert_not_called()

    def test_complete_disbursement_sends_loan_disbursed_email(self):
        from apps.loans.services.loan_service import LoanService

        user = UserFactory()
        customer = customer_factory(email="borrower@example.com")
        rm = UserFactory(email="rm.complete@example.com")
        cm = UserFactory(email="cm.complete@example.com")
        lead = _create_lead(lead_code="NTF-DONE", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )
        loan = LoanService.create_from_application(user=user, application=application)
        application.status = ApplicationStatus.DISBURSAL_SHEET_SENT
        application.save(update_fields=["status"])

        with patch.object(NotificationService, "send_loan_disbursed_email") as send_email:
            LoanService.disburse_loan(user=user, loan=loan, utr_reference="UTR123456")

        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.kwargs["loan"], loan)
        self.assertEqual(send_email.call_args.kwargs["application"], application)

    @patch("django.utils.timezone.localdate")
    def test_repayment_reminder_notifies_collection_officer(self, mock_localdate):
        today = date(2026, 7, 10)
        mock_localdate.return_value = today

        collector = UserFactory(email="collector@example.com")
        _assign_role(collector, "collection-officer")

        customer = customer_factory()
        rm = UserFactory(email="rm4@example.com")
        cm = UserFactory(email="cm4@example.com")
        lead = _create_lead(lead_code="NTF-003", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )
        _create_loan(application=application, due_date=today + timedelta(days=2))

        sent = LoanNotificationService.send_repayment_reminders()
        self.assertEqual(sent, 1)

        notes = Notification.objects.filter(recipient=collector)
        self.assertEqual(notes.count(), 1)
        self.assertIn("Repayment due soon", notes.first().title)
        self.assertEqual(
            notes.first().metadata.get("event_type"),
            NotificationService.EVENT_REPAYMENT_REMINDER,
        )

    @patch("django.utils.timezone.localdate")
    def test_overdue_notifies_collection_officer_and_cm_once_per_day(self, mock_localdate):
        today = date(2026, 7, 10)
        mock_localdate.return_value = today

        collector = UserFactory(email="collector2@example.com")
        _assign_role(collector, "collection-officer")

        customer = customer_factory()
        rm = UserFactory(email="rm5@example.com")
        cm = UserFactory(email="cm5@example.com")
        lead = _create_lead(lead_code="NTF-004", customer=customer, rm=rm, cm=cm)
        application = _create_application(
            customer=customer,
            lead=lead,
            cm=cm,
            status=ApplicationStatus.APPROVED,
        )
        _create_loan(application=application, due_date=today - timedelta(days=2))

        sent = LoanNotificationService.send_overdue_notifications()
        self.assertEqual(sent, 1)

        collector_notes = Notification.objects.filter(recipient=collector)
        cm_notes = Notification.objects.filter(recipient=cm)
        self.assertEqual(collector_notes.count(), 1)
        self.assertEqual(cm_notes.count(), 1)
        self.assertIn("Loan overdue", collector_notes.first().title)

        LoanNotificationService.send_overdue_notifications()
        self.assertEqual(Notification.objects.filter(recipient=collector).count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=cm).count(), 1)
