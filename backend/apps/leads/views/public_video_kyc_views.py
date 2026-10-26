import logging
from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.client_ip import get_client_ip
from apps.core.responses import error_response, success_response
from apps.core.throttling import OtpThrottle
from apps.integrations.digio.gateway import digio_web_sdk
from apps.leads.models import LeadVideoKycRequest, VideoKycRequestStatus

logger = logging.getLogger(__name__)


def _customer_location(row: LeadVideoKycRequest) -> dict | None:
    location = (row.session_details or {}).get("customer_location")
    return location if isinstance(location, dict) and location.get("latitude") else None


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
        completed = row.status == VideoKycRequestStatus.COMPLETED
        location_captured = _customer_location(row) is not None
        # Digio details are only handed out once the customer's location is on
        # record, so Video KYC cannot start without latitude/longitude.
        can_start = completed or location_captured
        return success_response(
            data={
                "id": str(row.id),
                "status": row.status,
                "customer_name": customer.full_name,
                "document_id": row.provider_request_id if can_start else "",
                "identifier": identifier if can_start else "",
                "environment": sdk["environment"],
                "sdk_url": sdk["sdk_url"],
                "completed": completed,
                "location_required": not location_captured,
            }
        )


def _coordinate(value, *, limit: int) -> Decimal | None:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None
    if not number.is_finite() or abs(number) > limit:
        return None
    return number


class PublicVideoKycLocationAPIView(APIView):
    """Record the customer's latitude/longitude before Video KYC can start."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [OtpThrottle]

    def post(self, request, pk):
        row = get_object_or_404(LeadVideoKycRequest, pk=pk)
        if row.status == VideoKycRequestStatus.EXPIRED:
            return error_response(message="This Video KYC link has expired.", status_code=400)
        latitude = _coordinate(request.data.get("latitude"), limit=90)
        longitude = _coordinate(request.data.get("longitude"), limit=180)
        if latitude is None or longitude is None or (latitude == 0 and longitude == 0):
            return error_response(
                message="Valid latitude and longitude are required.", status_code=400
            )
        accuracy = _coordinate(request.data.get("accuracy"), limit=1_000_000)
        details = dict(row.session_details or {})
        details["customer_location"] = {
            "latitude": float(round(latitude, 7)),
            "longitude": float(round(longitude, 7)),
            "accuracy_m": float(round(accuracy, 1)) if accuracy is not None else None,
            "captured_at": timezone.now().isoformat(),
            "ip_address": get_client_ip(request),
        }
        row.session_details = details
        row.save(update_fields=["session_details", "updated_at"])
        return success_response(data=details["customer_location"], message="Location captured")
