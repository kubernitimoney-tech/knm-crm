from celery import shared_task


def create_notification(recipient_id, title, body, metadata=None):
    from apps.notifications.models import Notification

    return Notification.objects.create(
        recipient_id=recipient_id,
        title=title,
        body=body,
        metadata=metadata or {},
    )


@shared_task(queue="notifications")
def send_notification_task(recipient_id, title, body, metadata=None):
    return create_notification(recipient_id, title, body, metadata)


@shared_task(queue="notifications")
def send_email_task(subject, template, context, recipients, cc=None, from_email=None):
    from apps.notifications.services.email_service import EmailService

    return EmailService.send_html(
        subject=subject,
        template=template,
        context=context or {},
        recipients=recipients or [],
        cc=cc or [],
        from_email=from_email,
    )


@shared_task(queue="notifications")
def send_repayment_reminder_notifications():
    from apps.notifications.services.loan_notification_service import LoanNotificationService

    count = LoanNotificationService.send_repayment_reminders()
    return {"sent": count}


@shared_task(queue="notifications")
def send_loan_overdue_notifications():
    from apps.notifications.services.loan_notification_service import LoanNotificationService

    count = LoanNotificationService.send_overdue_notifications()
    return {"sent": count}
