from io import BytesIO

from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.digio.esign import (
    complete_esign_aadhaar_otp,
    send_esign_aadhaar_otp,
    send_esign_email_otp,
    verify_esign_email_otp,
)
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import (
    customer_esign_review_url,
    customer_identifier,
    digio_web_sdk,
    esign_signing_url,
)
from apps.integrations.digio.pdf import build_agreement_pdf
from apps.leads.models import EsignRequestStatus, LeadEsignRequest


def _company_email() -> str:
    raw = str(getattr(settings, "DEFAULT_FROM_EMAIL", "") or "")
    if "<" in raw and ">" in raw:
        raw = raw[raw.find("<") + 1 : raw.find(">")]
    return raw.strip()


def _customer_city(customer) -> str:
    if not customer:
        return ""
    address = customer.addresses.order_by("-created_at").only("city").first()
    return (address.city if address else "") or ""


def _public_esign_payload(request, row: LeadEsignRequest) -> dict:
    customer = row.lead.customer
    signed = row.status == EsignRequestStatus.SIGNED
    sdk = digio_web_sdk()
    return {
        "id": str(row.id),
        "status": row.status,
        "sign_type": row.sign_type or "aadhaar",
        "document_name": row.document_label or "Loan Agreement",
        "customer_name": customer.full_name if customer else "",
        "review_url": customer_esign_review_url(row.id),
        "signing_url": esign_signing_url(row),
        "document_id": row.provider_request_id,
        "identifier": customer_identifier(customer=customer, recipient_email=row.recipient_email),
        "access_token": row.access_token or "",
        "environment": sdk["environment"],
        "sdk_url": sdk["sdk_url"],
        "document_url": request.build_absolute_uri(f"/api/v1/leads/esign/{row.id}/document/"),
        "signed": signed,
        "signed_file_url": (
            request.build_absolute_uri(row.signed_file.url) if row.signed_file else None
        ),
        "mobile_hint": _mask_mobile(customer.mobile_number if customer else ""),
        "email_hint": _mask_email(row.recipient_email or (customer.email if customer else "")),
        "email_verified": _email_verified(row),
        "company_name": getattr(settings, "BRAND_NAME", "Kuberniti Money"),
        "company_url": (getattr(settings, "FRONTEND_BASE_URL", "") or "").rstrip("/")
        or "https://kubernitimoney.com",
        "company_email": _company_email(),
        "reason": row.document_label or "Loan Agreement",
        "city": _customer_city(customer),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "signed_at": row.signed_at.isoformat() if row.signed_at else None,
        "transaction_id": row.provider_request_id or str(row.id),
    }


def _mask_mobile(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) < 4:
        return ""
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


def _mask_email(value: str) -> str:
    email = (value or "").strip()
    if "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        visible = local[:1] or "*"
        return f"{visible}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def _email_verified(row: LeadEsignRequest) -> bool:
    from django.core.cache import cache

    from apps.integrations.digio.esign import EMAIL_OK_KEY

    return bool(cache.get(EMAIL_OK_KEY.format(row.id)))


def _digio_error_response(exc: Exception):
    if isinstance(exc, DigioValidationError):
        return error_response(message=str(exc), status_code=400)
    if isinstance(exc, DigioConfigurationError):
        return error_response(message=str(exc), status_code=503)
    if isinstance(exc, DigioAPIError):
        return error_response(message=str(exc), status_code=502)
    raise exc


class PublicEsignAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        sync = str(request.query_params.get("sync") or "").strip().lower() in {"1", "true", "yes"}
        if sync and row.status != EsignRequestStatus.SIGNED:
            from apps.integrations.digio.webhooks import refresh_esign_from_provider

            row = refresh_esign_from_provider(row)
        return success_response(data=_public_esign_payload(request, row))


class PublicEsignEmailOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        try:
            send_esign_email_otp(row=row)
        except (DigioValidationError, DigioConfigurationError, DigioAPIError) as exc:
            return _digio_error_response(exc)
        except Exception as exc:
            return _digio_error_response(
                DigioValidationError(str(exc) or "Could not send the verification code.")
            )
        return success_response(
            data={
                "otp_sent": True,
                "email_hint": _mask_email(
                    row.recipient_email or (row.lead.customer.email if row.lead.customer else "")
                ),
            },
            message="Verification code sent to your email.",
        )


class PublicEsignVerifyEmailOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        try:
            verify_esign_email_otp(row=row, otp=str(request.data.get("otp") or ""))
        except (DigioValidationError, DigioConfigurationError, DigioAPIError) as exc:
            return _digio_error_response(exc)
        return success_response(
            data=_public_esign_payload(request, row),
            message="Email verified.",
        )


class PublicEsignOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        try:
            send_esign_aadhaar_otp(
                row=row,
                aadhaar_id=str(
                    request.data.get("aadhaar_number")
                    or request.data.get("aadhaar_id")
                    or request.data.get("vid")
                    or ""
                ),
            )
        except (DigioValidationError, DigioConfigurationError, DigioAPIError) as exc:
            return _digio_error_response(exc)
        return success_response(
            data={
                "otp_sent": True,
                "otp_channel": "aadhaar_mobile",
            },
            message="OTP sent to the Aadhaar-linked mobile number.",
        )


class PublicEsignVerifyOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        try:
            row = complete_esign_aadhaar_otp(row=row, otp=str(request.data.get("otp") or ""))
        except (DigioValidationError, DigioConfigurationError, DigioAPIError) as exc:
            return _digio_error_response(exc)
        return success_response(
            data=_public_esign_payload(request, row),
            message="Document signed successfully.",
        )


class PublicEsignDocumentAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        filename = "Agreement.pdf"
        if row.status == EsignRequestStatus.SIGNED and row.signed_file:
            return FileResponse(
                row.signed_file.open("rb"),
                as_attachment=False,
                filename=row.signed_file.name.rsplit("/", 1)[-1] or filename,
                content_type="application/pdf",
            )
        if row.source_file:
            return FileResponse(
                row.source_file.open("rb"),
                as_attachment=False,
                filename=row.source_file.name.rsplit("/", 1)[-1] or filename,
                content_type="application/pdf",
            )
        pdf_bytes = build_agreement_pdf(lead=row.lead)
        return FileResponse(
            BytesIO(pdf_bytes),
            as_attachment=False,
            filename=filename,
            content_type="application/pdf",
        )
