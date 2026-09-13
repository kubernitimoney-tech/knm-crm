"""In-app notification helpers for domain events."""

from __future__ import annotations

import logging

from django.utils import timezone

from apps.accounts.services.role_helpers import (
    ACCOUNT_FINANCE_SLUG,
    COLLECTION_OFFICER_SLUG,
    PRODUCTION_MANAGER_SLUG,
    get_active_users_with_role_slug,
)
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    EVENT_LEAD_INTAKE = "lead_intake_created"
    EVENT_APPLICATION_APPROVED = "application_approved"
    EVENT_DISBURSAL_SHEET_SENT = "disbursal_sheet_sent"
    EVENT_REPAYMENT_REMINDER = "repayment_reminder"
    EVENT_LOAN_OVERDUE = "loan_overdue"

    @staticmethod
    def _customer_label(customer) -> str:
        if customer is None:
            return "Customer"
        name = (getattr(customer, "full_name", None) or "").strip()
        if not name and hasattr(customer, "get_full_name"):
            name = customer.get_full_name().strip()
        return name or customer.email or customer.mobile_number or "Customer"

    @staticmethod
    def _customer_email(application) -> str | None:
        customer = application.customer
        if customer and getattr(customer, "email", None):
            return customer.email.strip()
        return None

    @staticmethod
    def _assigned_officer_emails(application) -> list[str]:
        """Assigned RM/CM emails for customer-facing mail CC."""
        emails: list[str] = []
        lead = application.lead if application.lead_id else None
        rm = application.assigned_rm or (lead.assigned_rm if lead else None)
        cm = application.assigned_cm or (lead.assigned_cm if lead else None)
        for officer in (rm, cm):
            if officer and getattr(officer, "email", None):
                emails.append(officer.email.strip())
        return emails

    @staticmethod
    def _format_amount(value) -> str:
        if value in (None, ""):
            return ""
        try:
            return f"{float(value):,.2f}"
        except (TypeError, ValueError):
            return str(value)

    @classmethod
    def _send_email_on_commit(
        cls,
        *,
        subject,
        template,
        context,
        recipients,
        cc=None,
        raise_on_error=False,
    ) -> None:
        """Send an email once the surrounding DB transaction commits.

        When ``raise_on_error`` is true the send runs immediately and SMTP
        failures propagate so API callers are not told the mail succeeded.
        """
        recipients = [email for email in recipients if email]
        cc = [email for email in (cc or []) if email]
        if not recipients:
            if raise_on_error:
                raise ValueError("No recipient email address is available.")
            return
        from django.db import transaction

        from apps.notifications.services.email_service import EmailService

        def _send() -> None:
            try:
                sent = EmailService.send_html(
                    subject=subject,
                    template=template,
                    context=context or {},
                    recipients=recipients,
                    cc=cc,
                )
                if sent:
                    logger.info(
                        "Sent email %r to %s (cc=%s)",
                        subject,
                        recipients,
                        cc or [],
                    )
                    return
                raise RuntimeError(
                    "Email was not sent. Check SMTP settings (EMAIL_HOST_USER / "
                    "EMAIL_HOST_PASSWORD) and restart Django after changing .env."
                )
            except Exception:
                logger.exception("Failed to send email %r to %s", subject, recipients)
                if raise_on_error:
                    raise

        if raise_on_error:
            _send()
            return
        transaction.on_commit(_send)

    @classmethod
    def notify_user(cls, user, *, title: str, body: str, metadata: dict | None = None) -> None:
        if not user or not getattr(user, "is_active", False):
            return
        from apps.notifications.tasks import create_notification

        create_notification(str(user.id), title, body, metadata or {})

    @classmethod
    def notify_users(cls, users, *, title: str, body: str, metadata: dict | None = None) -> None:
        for user in users:
            cls.notify_user(user, title=title, body=body, metadata=metadata)

    @classmethod
    def already_notified_today(
        cls,
        *,
        recipient_id,
        event_type: str,
        dedupe_key: str,
    ) -> bool:
        return Notification.objects.filter(
            recipient_id=recipient_id,
            metadata__event_type=event_type,
            metadata__dedupe_key=dedupe_key,
        ).exists()

    @classmethod
    def notify_user_once_per_day(
        cls,
        user,
        *,
        event_type: str,
        dedupe_key: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> None:
        if not user or not getattr(user, "is_active", False):
            return
        if cls.already_notified_today(
            recipient_id=user.id,
            event_type=event_type,
            dedupe_key=dedupe_key,
        ):
            return
        payload = {
            **(metadata or {}),
            "event_type": event_type,
            "dedupe_key": dedupe_key,
        }
        cls.notify_user(user, title=title, body=body, metadata=payload)

    @classmethod
    def notify_public_lead_intake(cls, lead) -> None:
        customer_label = cls._customer_label(lead.customer)
        source_name = lead.source.name if lead.source_id else "Website"
        title = f"New lead from {source_name}"
        body = (
            f"Lead {lead.lead_id} ({customer_label}) was submitted via public intake. "
            f"Status: {lead.get_status_display()}."
        )
        metadata = {
            "event_type": cls.EVENT_LEAD_INTAKE,
            "lead_id": str(lead.id),
            "lead_number": lead.lead_id,
            "source_slug": lead.source.slug if lead.source_id else None,
        }
        recipients = [user for user in (lead.assigned_rm, lead.assigned_cm) if user]
        cls.notify_users(recipients, title=title, body=body, metadata=metadata)

    @classmethod
    def notify_application_approved(cls, application) -> None:
        customer_label = cls._customer_label(application.customer)
        title = "Application approved"
        body = (
            f"Application {application.application_number} for {customer_label} "
            f"has been approved and is ready for production."
        )
        metadata = {
            "event_type": cls.EVENT_APPLICATION_APPROVED,
            "application_id": str(application.id),
            "application_number": application.application_number,
            "lead_id": str(application.lead_id) if application.lead_id else None,
        }
        managers = get_active_users_with_role_slug(PRODUCTION_MANAGER_SLUG)
        cls.notify_users(managers, title=title, body=body, metadata=metadata)

    @classmethod
    def send_sanction_approved_email(cls, application, *, decision=None) -> None:
        """Email customer with assigned RM/CM in CC (manual trigger)."""
        customer_label = cls._customer_label(application.customer)
        product_name = application.product.name if application.product_id else ""
        if decision is None:
            decision = (
                application.decisions.filter(decision="approved").order_by("-decided_at").first()
            )
        approved_amount = (
            decision.approved_amount
            if decision and decision.approved_amount is not None
            else application.approved_amount
        )
        customer_email = cls._customer_email(application)
        if not customer_email:
            raise ValueError(
                "This customer has no email address. Add one before sending the sanction email."
            )
        cls._send_email_on_commit(
            subject=f"Your loan application has been approved — {application.application_number}",
            template="sanction_approved",
            context={
                "customer_name": customer_label,
                "application_number": application.application_number,
                "product_name": product_name,
                "approved_amount": cls._format_amount(approved_amount),
            },
            recipients=[customer_email],
            cc=cls._assigned_officer_emails(application),
            raise_on_error=True,
        )

    @classmethod
    def notify_disbursal_sheet_sent(cls, application) -> None:
        customer_label = cls._customer_label(application.customer)
        title = "Disbursal sheet sent"
        body = (
            f"Disbursal sheet for application {application.application_number} "
            f"({customer_label}) has been submitted for account processing."
        )
        metadata = {
            "event_type": cls.EVENT_DISBURSAL_SHEET_SENT,
            "application_id": str(application.id),
            "application_number": application.application_number,
            "lead_id": str(application.lead_id) if application.lead_id else None,
        }
        account_users = get_active_users_with_role_slug(ACCOUNT_FINANCE_SLUG)
        cls.notify_users(account_users, title=title, body=body, metadata=metadata)

        details = application.disbursal_sheet_details or {}
        customer_email = cls._customer_email(application)
        if not customer_email:
            return
        cls._send_email_on_commit(
            subject=f"Disbursal In Progress — {application.application_number}",
            template="disbursal_sheet_sent",
            context={
                "customer_name": customer_label,
                "application_number": application.application_number,
                "amount_to_be_disbursed": cls._format_amount(details.get("amount_to_be_disbursed")),
                "bank_name": details.get("bank_name") or "",
            },
            recipients=[customer_email],
            cc=cls._assigned_officer_emails(application),
        )

    @classmethod
    def notify_repayment_reminder(cls, *, loan, days_until_due: int) -> None:
        application = loan.application
        customer_label = cls._customer_label(loan.customer)
        due_label = loan.due_date.isoformat() if loan.due_date else "N/A"
        if days_until_due == 0:
            when = "today"
        elif days_until_due == 1:
            when = "tomorrow"
        else:
            when = f"in {days_until_due} days"
        title = "Repayment due soon"
        body = f"Loan {loan.loan_account_number} ({customer_label}) is due {when} ({due_label})."
        metadata = {
            "loan_id": str(loan.id),
            "loan_account_number": loan.loan_account_number,
            "application_id": str(application.id) if application else None,
            "due_date": due_label,
            "days_until_due": days_until_due,
        }
        dedupe_key = f"loan:{loan.id}:due:{due_label}"
        collectors = get_active_users_with_role_slug(COLLECTION_OFFICER_SLUG)
        for collector in collectors:
            cls.notify_user_once_per_day(
                collector,
                event_type=cls.EVENT_REPAYMENT_REMINDER,
                dedupe_key=dedupe_key,
                title=title,
                body=body,
                metadata=metadata,
            )

    @classmethod
    def notify_loan_overdue(cls, *, loan, overdue_days: int) -> None:
        application = loan.application
        lead = application.lead if application else None
        customer_label = cls._customer_label(loan.customer)
        due_label = loan.due_date.isoformat() if loan.due_date else "N/A"
        title = "Loan overdue"
        body = (
            f"Loan {loan.loan_account_number} ({customer_label}) is overdue by "
            f"{overdue_days} day(s). Repayment was due on {due_label}."
        )
        metadata = {
            "loan_id": str(loan.id),
            "loan_account_number": loan.loan_account_number,
            "application_id": str(application.id) if application else None,
            "lead_id": str(lead.id) if lead else None,
            "due_date": due_label,
            "overdue_days": overdue_days,
        }
        dedupe_key = f"loan:{loan.id}:overdue:{timezone.localdate().isoformat()}"
        collectors = get_active_users_with_role_slug(COLLECTION_OFFICER_SLUG)
        for collector in collectors:
            cls.notify_user_once_per_day(
                collector,
                event_type=cls.EVENT_LOAN_OVERDUE,
                dedupe_key=dedupe_key,
                title=title,
                body=body,
                metadata=metadata,
            )
        cm = None
        if application:
            cm = application.assigned_cm or (lead.assigned_cm if lead else None)
        if cm:
            cls.notify_user_once_per_day(
                cm,
                event_type=cls.EVENT_LOAN_OVERDUE,
                dedupe_key=dedupe_key,
                title=title,
                body=body,
                metadata=metadata,
            )
