import base64
import binascii
import logging
import secrets
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import (
    customer_esign_review_url,
    customer_identifier,
    gateway_from_payload,
)
from apps.integrations.digio.pdf import (
    LAST_THREE_SIGN_COORDINATES,
    apply_completed_signature_marks,
    build_agreement_pdf,
    signer_from_lead,
)
from apps.leads.models import EsignRequestStatus, IntegrationProvider, LeadEsignRequest

logger = logging.getLogger(__name__)

SIGN_TYPES = frozenset({"aadhaar", "electronic"})


def resolve_esign_sign_type(sign_type: str = "") -> str:
    """Aadhaar/Protean is the CRM e-sign path. An explicit request value wins."""
    value = (sign_type or settings.DIGIO_ESIGN_SIGN_TYPE or "aadhaar").strip().lower()
    if value not in SIGN_TYPES:
        raise DigioConfigurationError(
            f"DIGIO_ESIGN_SIGN_TYPE must be one of {sorted(SIGN_TYPES)}, got '{value}'."
        )
    return value


def create_lead_esign_request(
    *,
    lead,
    requested_by,
    recipient_email: str = "",
    sign_type: str = "",
) -> LeadEsignRequest:
    customer = lead.customer
    identifier = customer_identifier(customer=customer, recipient_email=recipient_email)
    if not identifier:
        raise DigioValidationError("Customer email or mobile number is required to send e-sign.")

    sign_type = resolve_esign_sign_type(sign_type)

    esign_id = uuid4()
    review_url = customer_esign_review_url(esign_id)
    client = DigioClient.from_settings()
    pdf_bytes = build_agreement_pdf(lead=lead)
    payload = client.upload_pdf(
        file_name=f"{lead.lead_id}-loan-agreement.pdf",
        file_bytes=pdf_bytes,
        signer_name=customer.full_name or identifier,
        identifier=identifier,
        sign_type=sign_type,
        reason="Loan Agreement",
        redirect_url=f"{review_url}?done=1",
        display_on_page="custom",
        sign_coordinates=LAST_THREE_SIGN_COORDINATES,
    )
    entity_id, access_token, request_url = gateway_from_payload(
        payload=payload if isinstance(payload, dict) else {},
        identifier=identifier,
    )
    if not entity_id:
        raise DigioAPIError("Digio did not return a document id for the e-sign request.")

    row = LeadEsignRequest.objects.create(
        id=esign_id,
        lead=lead,
        requested_by=requested_by,
        document_label="Agreement.pdf",
        source_file=ContentFile(pdf_bytes, name=f"{lead.lead_id}-loan-agreement.pdf"),
        recipient_email=recipient_email or customer.email or "",
        status=EsignRequestStatus.SENT,
        sign_type=sign_type,
        provider=IntegrationProvider.DIGIO,
        provider_request_id=entity_id,
        request_url=request_url,
        access_token=access_token,
        created_by=requested_by,
        updated_by=requested_by,
    )
    email_sent = False
    email_error = ""
    if (row.recipient_email or "").strip():
        from apps.notifications.services.notification_service import NotificationService

        try:
            NotificationService.send_esign_request_email(
                lead=lead,
                request_url=review_url,
                recipient_email=row.recipient_email,
                sign_type=sign_type,
            )
            email_sent = True
        except Exception as exc:
            logger.exception("Failed to email e-sign guest link for lead %s", lead.lead_id)
            email_error = str(exc) or "SMTP could not send the e-sign email."
    else:
        email_error = "This customer has no email address."
    row.email_sent = email_sent
    row.email_error = email_error
    return row


def _esign_source_bytes(row: LeadEsignRequest) -> bytes:
    if row.source_file:
        row.source_file.open("rb")
        try:
            return row.source_file.read()
        finally:
            row.source_file.close()
    return build_agreement_pdf(lead=row.lead)


def _aadhaar_or_vid(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) == 12:
        from apps.core.validators import validate_aadhaar

        try:
            return validate_aadhaar(digits)
        except ValueError as exc:
            raise DigioValidationError(str(exc)) from exc
    if len(digits) == 16:
        return digits
    raise DigioValidationError("Enter a 12-digit Aadhaar number or 16-digit VID.")


EMAIL_OTP_KEY = "esign-email-otp:{}"
EMAIL_OK_KEY = "esign-email-ok:{}"
AADHAAR_OTP_KEY = "esign-aadhaar-otp:{}"


def _recipient_email(row: LeadEsignRequest) -> str:
    return (row.recipient_email or getattr(row.lead.customer, "email", "") or "").strip()


def _require_unsigned(row: LeadEsignRequest) -> None:
    if row.status == EsignRequestStatus.SIGNED:
        raise DigioValidationError("This document is already signed.")
    if row.status == EsignRequestStatus.EXPIRED:
        raise DigioValidationError("This signing request has expired.")


def _require_email_verified(row: LeadEsignRequest) -> None:
    from django.core.cache import cache

    if not cache.get(EMAIL_OK_KEY.format(row.id)):
        raise DigioValidationError("Verify the email OTP first, then continue to Aadhaar OTP.")


def _send_esign_otp_mail(
    *,
    row: LeadEsignRequest,
    email: str,
    otp_code: str,
    subject: str,
    heading: str,
    help_text: str,
) -> None:
    from apps.notifications.services.email_service import EmailService

    customer = getattr(row.lead, "customer", None)
    try:
        sent = EmailService.send_html(
            subject=subject,
            template="esign_otp",
            context={
                "customer_name": getattr(customer, "full_name", "") or "Customer",
                "lead_id": row.lead.lead_id,
                "otp_code": otp_code,
                "heading": heading,
                "help_text": help_text,
            },
            recipients=[email],
        )
    except Exception as exc:
        logger.exception("Failed to send e-sign OTP email for lead %s", row.lead.lead_id)
        raise DigioValidationError(
            "Could not send the verification code. Please try again in a moment."
        ) from exc
    if not sent:
        raise DigioValidationError(
            "Could not send the verification code. Please try again in a moment."
        )


def send_esign_email_otp(*, row: LeadEsignRequest) -> dict:
    from django.core.cache import cache

    _require_unsigned(row)
    email = _recipient_email(row)
    if not email:
        raise DigioValidationError("This signing request has no email address.")
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(EMAIL_OTP_KEY.format(row.id), otp_code, timeout=10 * 60)
    _send_esign_otp_mail(
        row=row,
        email=email,
        otp_code=otp_code,
        subject=f"Your e-sign verification code — {row.lead.lead_id}",
        heading="Your e-sign verification code",
        help_text="Enter this 6-digit code on the signing page to continue.",
    )
    return {"otp_sent": True}


def verify_esign_email_otp(*, row: LeadEsignRequest, otp: str) -> None:
    from django.core.cache import cache

    _require_unsigned(row)
    otp_code = "".join(ch for ch in str(otp or "") if ch.isdigit())
    cached = str(cache.get(EMAIL_OTP_KEY.format(row.id)) or "")
    if not cached:
        raise DigioValidationError("Request a new verification code, then enter it here.")
    if cached != otp_code:
        raise DigioValidationError("That verification code is incorrect.")
    cache.set(EMAIL_OK_KEY.format(row.id), True, timeout=45 * 60)
    cache.delete(EMAIL_OTP_KEY.format(row.id))


def send_esign_aadhaar_otp(*, row: LeadEsignRequest, aadhaar_id: str) -> dict:
    from django.core.cache import cache

    _require_unsigned(row)
    _require_email_verified(row)

    aadhaar = _aadhaar_or_vid(aadhaar_id)
    customer = getattr(row.lead, "customer", None)
    signer_name = (getattr(customer, "full_name", "") or "").strip()
    if not signer_name:
        raise DigioValidationError(
            "Customer name is required to send the Aadhaar OTP. Update the profile and try again."
        )

    unique_request_id = f"{str(row.id).replace('-', '')}{secrets.token_hex(3)}"
    client = DigioClient.from_settings()
    client.generate_aadhaar_esign_otp(
        aadhaar_id=aadhaar,
        unique_request_id=unique_request_id,
        name=signer_name,
        document_id=row.provider_request_id or "",
    )
    cache.set(
        AADHAAR_OTP_KEY.format(row.id),
        {
            "aadhaar_id": aadhaar,
            "via_digio": True,
            "unique_request_id": unique_request_id,
        },
        timeout=10 * 60,
    )
    return {"otp_sent": True, "otp_channel": "aadhaar_mobile"}


def complete_esign_aadhaar_otp(*, row: LeadEsignRequest, otp: str) -> LeadEsignRequest:
    from django.core.cache import cache
    from django.utils import timezone

    if row.status == EsignRequestStatus.SIGNED and row.signed_file:
        notify_esign_signed_copy(row)
        return row
    _require_email_verified(row)

    otp_code = "".join(ch for ch in str(otp or "") if ch.isdigit())
    if len(otp_code) < 4:
        raise DigioValidationError("Enter the OTP sent to the Aadhaar-linked mobile number.")

    cached = cache.get(AADHAAR_OTP_KEY.format(row.id)) or {}
    aadhaar_id = cached.get("aadhaar_id")
    unique_request_id = cached.get("unique_request_id") or str(row.id).replace("-", "")
    if not aadhaar_id:
        raise DigioValidationError("Request a new OTP, then enter it here.")

    signed_bytes = b""
    if cached.get("via_digio"):
        client = DigioClient.from_settings()
        pdf_bytes = _esign_source_bytes(row)
        payload = client.complete_aadhaar_esign(
            unique_request_id=unique_request_id,
            otp=otp_code,
            file_name=row.document_label or "Agreement.pdf",
            file_bytes=pdf_bytes,
            document_id=row.provider_request_id or "",
        )
        if isinstance(payload, dict):
            encoded = payload.get("file_data") or payload.get("document")
            if encoded:
                try:
                    signed_bytes = base64.b64decode(encoded, validate=True)
                except (ValueError, binascii.Error):
                    signed_bytes = b""
            document_id = str(payload.get("id") or payload.get("document_id") or "").strip()
            if document_id:
                row.provider_request_id = document_id
        if not signed_bytes and row.provider_request_id:
            try:
                signed_bytes = client.download_document(row.provider_request_id)
            except DigioAPIError:
                logger.exception(
                    "Failed to download Aadhaar-signed document %s", row.provider_request_id
                )
        if not signed_bytes:
            raise DigioAPIError("Digio did not return the signed document.")
        name, location = signer_from_lead(row.lead)
        signed_bytes = apply_completed_signature_marks(
            signed_bytes,
            signer_name=name,
            signer_location=location,
            signed_at=timezone.now(),
        )
    else:
        if str(cached.get("otp") or "") != otp_code:
            raise DigioValidationError("That OTP is incorrect. Request a new one if it expired.")
        signed_bytes = _esign_source_bytes(row)

    row.signed_file.save(
        f"{row.provider_request_id or row.id}.pdf",
        ContentFile(signed_bytes),
        save=False,
    )
    row.status = EsignRequestStatus.SIGNED
    row.signed_at = timezone.now()
    row.save()
    cache.delete(AADHAAR_OTP_KEY.format(row.id))
    cache.delete(EMAIL_OK_KEY.format(row.id))
    notify_esign_signed_copy(row, pdf_bytes=signed_bytes)
    return row


def notify_esign_signed_copy(row: LeadEsignRequest, *, pdf_bytes: bytes = b"") -> None:
    """Email the executed PDF once, after the signed file is stored."""
    if row.status != EsignRequestStatus.SIGNED:
        return
    content = pdf_bytes or b""
    if not content and row.signed_file:
        row.signed_file.open("rb")
        try:
            content = row.signed_file.read()
        finally:
            row.signed_file.close()
    if not content:
        return
    from django.core.cache import cache

    from apps.notifications.services.notification_service import NotificationService

    key = f"esign-signed-copy-email:{row.id}"
    if not cache.add(key, True, timeout=60 * 60 * 24 * 120):
        return
    try:
        NotificationService.send_esign_signed_copy_email(row=row, pdf_bytes=content)
    except Exception:
        cache.delete(key)
        logger.exception(
            "Failed to email signed e-sign copy for lead %s",
            getattr(getattr(row, "lead", None), "lead_id", row.pk),
        )
