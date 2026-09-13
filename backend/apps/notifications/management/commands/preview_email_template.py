"""Render an email template with sample data for local verification."""

from pathlib import Path

from django.core.management.base import BaseCommand

from apps.notifications.services.email_service import EmailService


class Command(BaseCommand):
    help = "Render an email template to stdout or a file (does not send mail)."

    def add_arguments(self, parser):
        parser.add_argument(
            "template",
            nargs="?",
            default="sanction_approved",
            help="Template name under templates/emails/ (default: sanction_approved)",
        )
        parser.add_argument(
            "--output",
            default="",
            help="Optional file path to write rendered HTML",
        )

    def handle(self, *args, **options):
        template = (options["template"] or "sanction_approved").strip()
        context = {
            "customer_name": "Rahul Sharma",
            "application_number": "APP-2026-00042",
            "product_name": "personal loan",
            "approved_amount": "25,000.00",
        }
        subject = "Your loan application has been approved — APP-2026-00042"
        html = EmailService.render_html(template=template, context=context, subject=subject)

        output_path = (options["output"] or "").strip()
        if output_path:
            path = Path(output_path)
            path.write_text(html, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote {path}"))
            return

        self.stdout.write(html)
