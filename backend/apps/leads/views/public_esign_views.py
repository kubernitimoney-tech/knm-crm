from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.digio.esign import complete_esign_aadhaar_otp, send_esign_aadhaar_otp
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import (
    customer_esign_review_url,
    customer_identifier,
    digio_web_sdk,
)
from apps.integrations.digio.pdf import build_agreement_pdf
from apps.leads.models import EsignRequestStatus, LeadEsignRequest


def _public_esign_payload(request, row: LeadEsignRequest) -> dict:
    customer = row.lead.customer
    signed = row.status == EsignRequestStatus.SIGNED
    sdk = digio_web_sdk()
    return {
        "id": str(row.id),
        "status": row.status,
        "sign_type": row.sign_type or "aadhaar",
        "document_name": row.document_label or "Agreement.pdf",
        "customer_name": customer.full_name if customer else "",
        "review_url": customer_esign_review_url(row.id),
        "signing_url": row.request_url,
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
    }


def _mask_mobile(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) < 4:
        return ""
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


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
        return success_response(data=_public_esign_payload(request, row))


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
            data={"otp_sent": True, "mobile_hint": _mask_mobile(row.lead.customer.mobile_number)},
            message="OTP sent to the mobile number linked with this Aadhaar / VID.",
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
