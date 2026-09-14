from django.core import mail
from django.test import TestCase

from apps.notifications.services.email_service import EmailService


class SanctionEmailTemplateTests(TestCase):
    def test_html_letter_uses_kuberniti_money_not_indi_rupee(self):
        html = EmailService.render_html(
            template="sanction_approved",
            context={
                "customer_name": "Naveen",
                "customer_mobile": "9876543210",
                "application_number": "APP-1",
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
            },
            subject="Sanction Approval",
        )

        assert "Kuberniti Money" in html
        assert "Indi Rupee" not in html
        assert "IndiRupee" not in html
        assert "SCHEDULE OF SANCTIONED LOAN TERMS" in html
        assert "Mandatory Acceptance Format" in html
        assert "Komal Dhawan" in html
        assert "cid:brand_logo" in html or "data:image" in html or "Kuberniti Money" in html

    def test_send_html_attaches_html_alternative(self):
        sent = EmailService.send_html(
            subject="Sanction Approval by Credit Team of Kuberniti Money — APP-1",
            template="sanction_approved",
            context={
                "customer_name": "Naveen",
                "application_number": "APP-1",
                "approved_amount": "25,000.00",
                "interest_rate": "1.00% per day",
                "penalty_rate": "0.25% per day",
                "bounce_penalty": "1,000.00",
            },
            recipients=["customer@example.com"],
        )

        assert sent == 1
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.alternatives
        html, content_type = message.alternatives[0]
        assert content_type == "text/html"
        assert "Kuberniti Money" in html
        assert "Indi Rupee" not in html
        assert "SCHEDULE OF SANCTIONED LOAN TERMS" in html
        assert "Kuberniti Money" in message.body
        assert "Indi Rupee" not in message.body
