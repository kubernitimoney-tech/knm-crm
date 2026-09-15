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
        assert "#2A2D4F" in html
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
        assert "Kuberniti Money" in message.from_email
        assert "<" in message.from_email


class LoanDisbursedEmailTemplateTests(TestCase):
    _context = {
        "customer_name": "ROHIT DHINGRA",
        "loan_number": "LDR573689062731",
        "principal_amount": "40,000",
        "interest_rate": "1%",
        "tenure_days": "33",
        "repayment_amount": "53,200",
        "repayment_amount_words": "Fifty-Three Thousand Two Hundred",
    }

    def test_html_uses_kuberniti_money_logo_and_wording(self):
        html = EmailService.render_html(
            template="loan_disbursed",
            context=self._context,
            subject="Kuberniti Money - Loan Disbursed",
        )

        assert "Kuberniti Money" in html
        assert "Lending Rupee" not in html
        assert "lendingrupee" not in html.lower()
        assert "Indi Rupee" not in html
        assert "Dear ROHIT DHINGRA" in html
        assert "LDR573689062731" in html
        assert "40,000" in html
        assert "1%" in html
        assert "33" in html
        assert "53,200" in html
        assert "Fifty-Three Thousand Two Hundred" in html
        assert "Please repay on due date to avoid penal interest." in html
        assert "#2A2D4F" in html
        assert "cid:brand_logo" in html or "data:image" in html

    def test_plain_text_matches_disbursed_letter_format(self):
        body = EmailService.render_plain_text(
            template="loan_disbursed",
            context=self._context,
        )

        assert "Dear ROHIT DHINGRA," in body
        assert "Loan Number: LDR573689062731." in body
        assert "40,000" in body
        assert "1%" in body
        assert "33 days" in body
        assert "53,200 ( Fifty-Three Thousand Two Hundred ) only." in body
        assert "Please repay on due date to avoid penal interest." in body
        assert "Team" in body
        assert "Kuberniti Money" in body
        assert "Lending Rupee" not in body

    def test_send_html_attaches_html_alternative(self):
        sent = EmailService.send_html(
            subject="Kuberniti Money - Loan Disbursed",
            template="loan_disbursed",
            context=self._context,
            recipients=["rohit.dhingra200@gmail.com"],
            cc=["confirmation@kubernitimoney.com"],
        )

        assert sent == 1
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.subject == "Kuberniti Money - Loan Disbursed"
        assert message.to == ["rohit.dhingra200@gmail.com"]
        assert message.cc == ["confirmation@kubernitimoney.com"]
        html, content_type = message.alternatives[0]
        assert content_type == "text/html"
        assert "Kuberniti Money" in html
        assert "Lending Rupee" not in html
        assert "Kuberniti Money" in message.body
        assert "Lending Rupee" not in message.body
        assert "Kuberniti Money" in message.from_email
