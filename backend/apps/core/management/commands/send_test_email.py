"""Send a test email to verify SMTP settings."""

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Send a test email using the configured EMAIL_* settings."

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            nargs="?",
            default="",
            help="Recipient email address (defaults to EMAIL_HOST_USER)",
        )

    def handle(self, *args, **options):
        if not settings.EMAIL_HOST:
            raise CommandError(
                "EMAIL_HOST is not set. Add SMTP settings to backend/.env and restart Django."
            )

        recipient = (options["recipient"] or settings.EMAIL_HOST_USER or "").strip()
        if not recipient:
            raise CommandError("Provide a recipient or set EMAIL_HOST_USER in .env")

        sent = send_mail(
            subject="LMS test email",
            message="If you received this, SMTP is configured correctly.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        self.stdout.write(
            self.style.SUCCESS(f"Sent {sent} message(s) to {recipient} via {settings.EMAIL_HOST}")
        )
