"""Transactional email helper."""

from __future__ import annotations

import base64
import mimetypes
from email.mime.image import MIMEImage
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import engines
from django.template.loader import render_to_string

EMAIL_LOGO_CONTENT_ID = "brand_logo"


class EmailService:
    @staticmethod
    def _logo_path() -> Path | None:
        logo_path = Path(getattr(settings, "EMAIL_LOGO_PATH", "") or "")
        return logo_path if logo_path.is_file() else None

    @classmethod
    def _branding_context(cls) -> dict:
        context = {
            "brand_name": getattr(settings, "BRAND_NAME", "Kuberniti Money"),
            "support_email": getattr(settings, "SUPPORT_EMAIL", ""),
            "website_url": getattr(settings, "WEBSITE_URL", "https://www.kubernitimoney.com"),
            "primary_color": getattr(settings, "BRAND_PRIMARY_COLOR", "#2A2D4F"),
            "secondary_color": getattr(settings, "BRAND_SECONDARY_COLOR", "#424665"),
            "brand_bg_color": getattr(settings, "BRAND_BG_COLOR", "#F4F6F9"),
            "logo_cid": "",
            "logo_data_url": "",
        }
        logo_path = cls._logo_path()
        if logo_path is None:
            return context

        mime_type = mimetypes.guess_type(logo_path.name)[0] or "image/png"
        encoded = base64.b64encode(logo_path.read_bytes()).decode("ascii")
        context["logo_cid"] = EMAIL_LOGO_CONTENT_ID
        context["logo_data_url"] = f"data:{mime_type};base64,{encoded}"
        return context

    @staticmethod
    def _reset_template_cache() -> None:
        """Pick up on-disk template edits without restarting Celery workers."""
        engine = engines["django"]
        for loader in getattr(engine.engine, "template_loaders", ()):
            reset = getattr(loader, "reset", None)
            if callable(reset):
                reset()

    @classmethod
    def render_html(
        cls,
        *,
        template: str,
        context: dict,
        subject: str = "",
        for_send: bool = False,
    ) -> str:
        """Render `emails/<template>.html` without sending (preview / local tools only)."""
        branding = cls._branding_context()
        if for_send and branding.get("logo_cid"):
            branding["logo_data_url"] = ""
        full_context = {
            **branding,
            "subject": subject,
            **(context or {}),
        }
        cls._reset_template_cache()
        return render_to_string(f"emails/{template}.html", full_context)

    @classmethod
    def render_plain_text(
        cls,
        *,
        template: str,
        context: dict | None = None,
    ) -> str:
        """Build a plain-text body for a known template key (does not load HTML templates)."""
        ctx = context or {}
        brand_name = getattr(settings, "BRAND_NAME", "Kuberniti Money")
        support_email = getattr(settings, "SUPPORT_EMAIL", "") or ""
        footer = (
            f"This is an automated message from {brand_name}. Please do not reply to this email."
        )
        if support_email:
            footer += f" For assistance, contact {support_email}."

        customer_name = (ctx.get("customer_name") or "").strip() or "Customer"
        application_number = (ctx.get("application_number") or "").strip()

        if template == "sanction_approved":
            return cls._plain_sanction_letter(ctx, brand_name=brand_name)

        if template == "esign_otp":
            otp_code = (ctx.get("otp_code") or "").strip()
            heading = (ctx.get("heading") or "Your e-sign verification code").strip()
            help_text = (ctx.get("help_text") or "Enter this code to continue signing.").strip()
            lead_id = (ctx.get("lead_id") or "").strip()
            lines = [
                heading,
                "",
                f"Dear {customer_name.title() if customer_name else 'Customer'},",
                "",
                help_text,
                "",
                f"Verification code: {otp_code}",
            ]
            if lead_id:
                lines.extend(["", f"Lead: {lead_id}"])
            lines.extend(
                [
                    "",
                    "This code expires in 10 minutes.",
                    f"Thank you for choosing {brand_name}.",
                    "",
                    footer,
                ]
            )
            return "\n".join(lines)

        if template == "loan_disbursed":
            loan_number = (ctx.get("loan_number") or "").strip()
            principal_amount = (ctx.get("principal_amount") or "").strip()
            interest_rate = (ctx.get("interest_rate") or "").strip()
            tenure_days = (ctx.get("tenure_days") or "").strip()
            repayment_amount = (ctx.get("repayment_amount") or "").strip()
            repayment_words = (ctx.get("repayment_amount_words") or "").strip()
            repay_line = f"Your repayment amount is {repayment_amount}"
            if repayment_words:
                repay_line += f" ( {repayment_words} )"
            repay_line += " only."
            return "\n".join(
                [
                    f"Dear {customer_name},",
                    "",
                    f"Loan Number: {loan_number}.",
                    "",
                    f"We are pleased to have disbursed a loan for {principal_amount} "
                    f"@ {interest_rate} interest per day for a period of {tenure_days} days "
                    "on the terms and conditions agreed by you.",
                    "",
                    repay_line,
                    "",
                    "Please repay on due date to avoid penal interest.",
                    "",
                    "Team",
                    brand_name,
                ]
            )

        if template == "esign_request":
            signing_url = (ctx.get("signing_url") or "").strip()
            lead_id = (ctx.get("lead_id") or "").strip()
            sign_method = (ctx.get("sign_method") or "electronic signature OTP").strip()
            lines = [
                "Please e-sign your loan agreement.",
                "",
                f"Dear {customer_name.title() if customer_name else 'Customer'},",
                "",
                f"Please review Agreement.pdf, then continue with {sign_method}.",
            ]
            if lead_id:
                lines.extend(["", f"Lead: {lead_id}"])
            if signing_url:
                lines.extend(
                    [
                        "",
                        f"Click here to review the document, then sign with {sign_method}:",
                        signing_url,
                    ]
                )
            lines.extend(
                [
                    "",
                    "If the button in another email asks you to log in to Digio Drive, ignore it.",
                    f"Thank you for choosing {brand_name}.",
                    "",
                    footer,
                ]
            )
            return "\n".join(lines)

        if template == "video_kyc_request":
            kyc_url = (ctx.get("kyc_url") or "").strip()
            lead_id = (ctx.get("lead_id") or "").strip()
            lines = [
                "Complete your identity verification.",
                "",
                f"Dear {customer_name.title() if customer_name else 'Customer'},",
                "",
                "Please complete your Aadhaar, PAN, selfie and OCR verification.",
            ]
            if lead_id:
                lines.extend(["", f"Lead: {lead_id}"])
            if kyc_url:
                lines.extend(["", "Open your secure Video KYC link:", kyc_url])
            lines.extend(
                [
                    "",
                    "Do not share this verification link with anyone.",
                    f"Thank you for choosing {brand_name}.",
                    "",
                    footer,
                ]
            )
            return "\n".join(lines)

        if template == "disbursal_sheet_sent":
            lines = [
                "Disbursal In Progress",
                "",
                f"Dear {customer_name},",
                "",
                "The disbursal sheet for your loan has been sent for processing. "
                "Your funds will be credited to the registered bank account shortly.",
                "",
                f"Application Number: {application_number}",
            ]
            amount = (ctx.get("amount_to_be_disbursed") or "").strip()
            if amount:
                lines.append(f"Amount to be Disbursed: ₹ {amount}")
            bank_name = (ctx.get("bank_name") or "").strip()
            if bank_name:
                lines.append(f"Bank: {bank_name}")
            lines.extend(
                [
                    "",
                    "You will receive a confirmation once the amount is disbursed.",
                    f"Thank you for choosing {brand_name}.",
                    "",
                    footer,
                ]
            )
            return "\n".join(lines)

        # Unknown key: generic fallback without loading HTML templates.
        lines = [f"Notification from {brand_name}", ""]
        for key, value in sorted(ctx.items()):
            if value is None or value == "":
                continue
            lines.append(f"{key}: {value}")
        lines.extend(["", footer])
        return "\n".join(lines)

    @staticmethod
    def _plain_sanction_letter(ctx: dict, *, brand_name: str) -> str:
        website = (ctx.get("website_url") or "https://www.kubernitimoney.com").strip()
        customer_name = (ctx.get("customer_name") or "Customer").strip()
        customer_mobile = (ctx.get("customer_mobile") or "").strip()
        application_number = (ctx.get("application_number") or "").strip()
        letter_datetime = (ctx.get("letter_datetime") or "").strip()
        penalty_rate = (ctx.get("penalty_rate") or "1.00% per day").strip()
        bounce_penalty = (ctx.get("bounce_penalty") or "1,000.00").strip()

        def rupee(key: str) -> str:
            value = (ctx.get(key) or "").strip()
            return f"₹ {value}" if value else "—"

        lines = [
            f"Sanction Approval by Credit Team of {brand_name}, a Product of "
            "Har Shreejee Finance and Leasing Co. Ltd. (www.kubernitimoney.com)",
            "Corporate Office: E-37, 1st Floor, Sector 3, Noida, Uttar Pradesh, 201301",
            "Reg. No. RBI B-14.02044",
            "",
            f"Date & time: {letter_datetime or '—'}",
            f"Loan Application ID: {application_number or '—'}",
            f"Applicant Name: {customer_name}",
            "",
            "RESOLVED THAT, based on the assessment of the loan application submitted by "
            f"the above-mentioned applicant through {website}, the Credit Team hereby "
            "accords approval in principle for the issuance of a short-term personal loan, "
            "subject to the disclosures, terms, and conditions as set out below.",
            "",
            "SCHEDULE OF SANCTIONED LOAN TERMS",
            f"Loan Amount (Principal): {rupee('approved_amount')}",
            f"Rate of Interest: {(ctx.get('interest_rate') or '—')}",
            f"Tenure: {(ctx.get('tenure') or '—')}",
            f"Processing Fees: {rupee('processing_fee')}",
            f"GST on Processing Fees: {rupee('gst')}",
            f"Net Disbursed Amount: {rupee('net_disbursed_amount')}",
            f"Repayment Amount (Total): {rupee('repayment_amount')}",
            f"Due Date for Repayment: {(ctx.get('due_date') or '—')}",
            "Repayment Mode: UPI, IMPS, NEFT, RTGS, Cash. Fallback E-Mandate/E-NACH, Cheque",
            f"Penalty Interest: {penalty_rate}",
            'Payment Structure: Bullet Payment (as per "BLA")',
            "",
            "FURTHER RESOLVED THAT the following disclosures and conditions form an "
            "integral part of this resolution and shall be binding upon the Borrower upon acceptance:",
            "",
            "I. This sanction is extended in principle only and does not constitute an "
            "unconditional or automatic commitment to disburse funds. Disbursement shall be "
            "effected only after successful completion of all mandatory pre-disbursal "
            "requirements and the Company's final internal verification and approval at the "
            "time of disbursal.",
            "",
            "Acceptance of this sanction must be provided through a clear and unconditional "
            "reply confirming that the Borrower has read, understood, and agreed to all terms "
            "and conditions. Such acceptance, whether by email or digital confirmation, shall "
            "constitute a binding acknowledgment and consent to proceed further.",
            "",
            "Mandatory Acceptance Format:",
            "I accept the terms and conditions of the loan as mentioned. Please proceed further.",
            f"Name: {customer_name}",
            f"Registered Mobile Number: {customer_mobile}",
            "",
            "II. The Borrower is under no obligation to accept this offer. The Company advises "
            "the Borrower to review all terms carefully and proceed only if fully understood "
            "and agreed upon.",
            "",
            "III. Following the Borrower's acceptance, the sanctioned loan amount shall be "
            "disbursed only after successful completion of the following mandatory steps: "
            "(a) physical address/home verification, (b) completion of Video KYC, "
            "(c) co-execution of the E-Sign Loan Agreement, and (d) registration of "
            "E-Mandate/E-NACH. Upon fulfilment of these conditions, the net disbursed amount "
            "shall be credited to the Borrower's verified salary account.",
            "",
            "IV. While repayment through UPI, IMPS, or online transfer is allowed before or on "
            "the due date, the Borrower expressly acknowledges that in the event of non-payment "
            "by the due date, the Lender is authorised to initiate debit attempts via E-Mandate / "
            "E-NACH or any other permissible recovery process as prescribed under applicable law, "
            "until all dues are recovered.",
            "",
            f"V. In the event of non-payment on or before the due date, penal interest at the "
            f"rate of {penalty_rate} shall be levied strictly on the principal loan amount only, "
            "for the period of default, from the due date until the date of actual repayment. "
            "Such penal interest shall be simple in nature and shall not be compounded, nor "
            "charged on accrued interest or other charges.",
            "",
            f"VI. E-Mandate or cheque bounce will attract a penalty charge of ₹ {bounce_penalty} "
            "per instance.",
            "",
            "VII. There is no cooling-off or look-up period, and no prepayment penalty shall "
            "apply if the loan is repaid early.",
            "",
            "VIII. If the Borrower chooses not to proceed or does not provide acceptance in the "
            "prescribed format, this sanction shall be considered cancelled and no fees shall "
            "be charged.",
            "",
            "IX. The Borrower is required to submit a physical blank signed cheque solely as a "
            "security instrument. The Borrower acknowledges that such cheque shall be presented "
            "for recovery only in the event of non-payment or default, strictly in accordance "
            "with the terms of the executed Loan Agreement and applicable law. This cheque shall "
            "be securely retained by the Company and will be destroyed only upon: (a) full and "
            "final repayment of all dues, (b) issuance of the No Objection Certificate (NOC), "
            "and (c) receipt of a written destruction request from the Borrower via email. The "
            "destruction shall be completed within 45 days of such request, and photographic "
            "confirmation shall be provided to the Borrower via email for their records. "
            "Provided that, if any outstanding amount remains payable by the Borrower to the "
            "Company, the Company shall retain the cheque securely and reserves the right to "
            "present it for recovery in the event of unpaid dues, until all liabilities are cleared.",
            "",
            "X. The Borrower expressly acknowledges and authorizes the Company to report, "
            "disclose, and update the Borrower's loan account information, including repayment "
            "behavior, delays, defaults, or closure status, to one or more Credit Information "
            "Companies / Credit Bureaus in accordance with applicable law.",
            "",
            "XI. This sanction letter is supplemental to, and shall form an integral part of, "
            'the executed Borrower\'s Loan Agreement ("BLA"). In the event of any inconsistency, '
            "the terms of the BLA shall prevail.",
            "",
            "XII. Any legal disputes shall be subject to the exclusive jurisdiction of Delhi Courts.",
            "",
            "Note: The effective annualized cost (Annual Percentage Rate – APR), inclusive of all "
            "applicable interest, fees, and charges, is reflected in the executed Borrower's Loan "
            "Agreement and may be reviewed upon request.",
            "",
            "GRIEVANCE REDRESSAL CONTACT",
            "Komal Dhawan",
            "Grievance Redressal Officer",
            "E-mail: grievance@kubernitimoney.com",
            "",
            "NOTE TO BORROWER: Timely repayment of this loan not only protects your credit health "
            "but also enhances your eligibility for higher amounts and better terms in the future.",
            "",
            "Best Regards",
            f"{brand_name} – Your Credit Companion",
            "A product of Har Shreejee Finance and Leasing Co. Ltd.",
            f"Approved by: Credit Team, {brand_name}",
        ]
        return "\n".join(lines)

    @staticmethod
    def _clean_recipients(recipients) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in recipients or []:
            value = (raw or "").strip()
            key = value.lower()
            if value and key not in seen:
                seen.add(key)
                cleaned.append(value)
        return cleaned

    @classmethod
    def _attach_inline_logo(cls, message: EmailMultiAlternatives) -> None:
        logo_path = cls._logo_path()
        if logo_path is None:
            return
        mime_type = mimetypes.guess_type(logo_path.name)[0] or "image/png"
        subtype = mime_type.split("/")[-1] if "/" in mime_type else "png"
        image = MIMEImage(logo_path.read_bytes(), _subtype=subtype)
        image.add_header("Content-ID", f"<{EMAIL_LOGO_CONTENT_ID}>")
        image.add_header("Content-Disposition", "inline", filename=logo_path.name)
        message.attach(image)
        message.mixed_subtype = "related"

    @classmethod
    def send_html(
        cls,
        *,
        subject: str,
        template: str,
        context: dict,
        recipients,
        cc=None,
    ) -> int:
        """Send a multipart email (plain text + HTML) for the given template key."""
        to_addresses = cls._clean_recipients(recipients)
        if not to_addresses:
            return 0

        cc_addresses = cls._clean_recipients(cc)
        to_lower = {address.lower() for address in to_addresses}
        cc_addresses = [address for address in cc_addresses if address.lower() not in to_lower]

        from_email = (getattr(settings, "DEFAULT_FROM_EMAIL", None) or "").strip()
        if not from_email:
            raise ValueError(
                "DEFAULT_FROM_EMAIL / EMAIL_HOST_USER is empty. Set them in backend/.env "
                "and recreate the Django container."
            )

        payload = context or {}
        text_body = cls.render_plain_text(template=template, context=payload)
        html_body = cls.render_html(
            template=template,
            context=payload,
            subject=subject,
            for_send=True,
        )
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=to_addresses,
            cc=cc_addresses or None,
        )
        message.attach_alternative(html_body, "text/html")
        cls._attach_inline_logo(message)
        return message.send(fail_silently=False)
