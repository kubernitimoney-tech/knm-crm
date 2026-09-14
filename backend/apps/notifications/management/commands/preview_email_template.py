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
        if template == "sanction_approved":
            context = {
                "customer_name": "Naveen",
                "customer_mobile": "9876543210",
                "application_number": "APP-2026-00042",
                "product_name": "Payday Loan",
                "letter_datetime": "14th September, 2026 - 11:20 AM",
                "approved_amount": "25,000.00",
                "interest_rate": "1.00% per day",
                "tenure": "15 days",
                "processing_fee": "2,500.00",
                "gst": "450.00",
                "net_disbursed_amount": "22,050.00",
                "repayment_amount": "28,750.00",
                "due_date": "29.09.2026",
                "penalty_rate": "0.25% per day",
                "bounce_penalty": "1,000.00",
                "repayment_mode": (
                    "UPI, IMPS, NEFT, RTGS, Cash. Fallback E-Mandate/E-NACH, Cheque"
                ),
                "payment_structure": 'Bullet Payment (as per "BLA")',
            }
            subject = "Sanction Approval by Credit Team of Kuberniti Money — APP-2026-00042"
        else:
            context = {
                "customer_name": "Rahul Sharma",
                "application_number": "APP-2026-00042",
                "amount_to_be_disbursed": "22,050.00",
                "bank_name": "HDFC Bank",
            }
            subject = "Disbursal In Progress — APP-2026-00042"

        html = EmailService.render_html(template=template, context=context, subject=subject)

        output_path = (options["output"] or "").strip()
        if output_path:
            path = Path(output_path)
            path.write_text(html, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote {path}"))
            return

        self.stdout.write(html)
