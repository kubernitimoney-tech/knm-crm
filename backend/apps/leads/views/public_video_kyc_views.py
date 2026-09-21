import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import success_response
from apps.integrations.digio.gateway import digio_web_sdk
from apps.leads.models import LeadVideoKycRequest, VideoKycRequestStatus

logger = logging.getLogger(__name__)


class PublicVideoKycAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        row = get_object_or_404(
            LeadVideoKycRequest.objects.select_related("lead__customer"),
            pk=pk,
        )
        sync = str(request.query_params.get("sync") or "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        force = str(request.query_params.get("force") or "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        if sync and row.status != VideoKycRequestStatus.COMPLETED:
            from apps.integrations.digio.webhooks import refresh_video_kyc_from_provider

            try:
                row = refresh_video_kyc_from_provider(row, force=force)
            except Exception:
                logger.exception("Could not sync Video KYC %s from Digio", row.pk)
                row.refresh_from_db()
        customer = row.lead.customer
        identifier = str(
            (row.session_details or {}).get("customer_identifier")
            or customer.mobile_number
            or row.recipient_email
            or customer.email
            or ""
        ).strip()
        sdk = digio_web_sdk()
        return success_response(
            data={
                "id": str(row.id),
                "status": row.status,
                "customer_name": customer.full_name,
                "document_id": row.provider_request_id,
                "identifier": identifier,
                "environment": sdk["environment"],
                "sdk_url": sdk["sdk_url"],
                "completed": row.status == VideoKycRequestStatus.COMPLETED,
            }
        )
