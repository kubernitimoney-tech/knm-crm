from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import success_response
from apps.integrations.digio.gateway import (
    customer_esign_review_url,
    customer_identifier,
    digio_web_sdk,
)
from apps.integrations.digio.pdf import build_agreement_pdf
from apps.leads.models import EsignRequestStatus, LeadEsignRequest


class PublicEsignAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        row = get_object_or_404(LeadEsignRequest.objects.select_related("lead__customer"), pk=pk)
        customer = row.lead.customer
        signed = row.status == EsignRequestStatus.SIGNED
        sdk = digio_web_sdk()
        return success_response(
            data={
                "id": str(row.id),
                "status": row.status,
                "sign_type": row.sign_type,
                "document_name": row.document_label or "Agreement.pdf",
                "customer_name": customer.full_name if customer else "",
                "review_url": customer_esign_review_url(row.id),
                "signing_url": row.request_url,
                "document_id": row.provider_request_id,
                "identifier": customer_identifier(
                    customer=customer, recipient_email=row.recipient_email
                ),
                "access_token": row.access_token,
                "environment": sdk["environment"],
                "sdk_url": sdk["sdk_url"],
                "document_url": request.build_absolute_uri(
                    f"/api/v1/leads/esign/{row.id}/document/"
                ),
                "signed": signed,
                "signed_file_url": (
                    request.build_absolute_uri(row.signed_file.url) if row.signed_file else None
                ),
            }
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
