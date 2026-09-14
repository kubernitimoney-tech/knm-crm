"""Transactional email helper."""

from __future__ import annotations

import base64
import mimetypes
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
            lines = [
                "Your loan application has been approved.",
                "",
                f"Dear {customer_name.title() if customer_name else 'Customer'},",
                "",
                "We are pleased to inform you that your loan application has been approved.",
                "",
                f"Application Number: {application_number}",
            ]
            product_name = (ctx.get("product_name") or "").strip()
            if product_name:
                lines.append(f"Product: {product_name.title()}")
            approved_amount = (ctx.get("approved_amount") or "").strip()
            if approved_amount:
                lines.append(f"Approved Loan Amount: ₹ {approved_amount}")
            lines.extend(
                [
                    "",
                    "Our team will reach out shortly with the next steps for disbursal.",
                    f"Thank you for choosing {brand_name}.",
                    "",
                    footer,
                ]
            )
            return "\n".join(lines)

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
    def send_html(
        cls,
        *,
        subject: str,
        template: str,
        context: dict,
        recipients,
        cc=None,
    ) -> int:
        """
        Send a plain-text email for the given template key.

        HTML templates under ``templates/emails/`` are kept for preview only and
        are not attached to outbound mail.
        """
        to_addresses = cls._clean_recipients(recipients)
        if not to_addresses:
            return 0

        cc_addresses = cls._clean_recipients(cc)
        to_lower = {address.lower() for address in to_addresses}
        cc_addresses = [address for address in cc_addresses if address.lower() not in to_lower]

        text_body = cls.render_plain_text(template=template, context=context or {})
        from_email = (getattr(settings, "DEFAULT_FROM_EMAIL", None) or "").strip()
        if not from_email:
            raise ValueError(
                "DEFAULT_FROM_EMAIL / EMAIL_HOST_USER is empty. Set them in backend/.env "
                "and recreate the Django container."
            )

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=to_addresses,
            cc=cc_addresses or None,
        )
        if template == "esign_request":
            message.attach_alternative(
                cls.render_html(
                    template=template,
                    context=context or {},
                    subject=subject,
                    for_send=True,
                ),
                "text/html",
            )
        return message.send(fail_silently=False)
