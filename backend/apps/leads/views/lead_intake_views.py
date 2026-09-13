from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.leads.serializers import PublicLeadCreateSerializer, PublicLeadTrackSerializer
from apps.leads.services.lead_intake_service import LeadIntakeError, LeadIntakeService
from apps.leads.services.lead_track_service import LeadTrackError, LeadTrackService
from apps.notifications.services.notification_service import NotificationService


def _client_key(request) -> str:
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return forwarded or request.META.get("REMOTE_ADDR") or "anon"


class PublicLeadIntakeAPIView(APIView):
    """Submit a new lead from website, social media, or ads — no login required."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicLeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            lead = LeadIntakeService.create_from_validated_data(
                user=None,
                data=serializer.validated_data,
            )
        except LeadIntakeError as exc:
            return error_response(
                message=exc.message,
                errors=exc.errors,
                status_code=exc.status_code,
            )
        NotificationService.notify_public_lead_intake(lead)
        return success_response(
            data=LeadIntakeService.public_response_payload(lead),
            message="Lead submitted successfully",
            status_code=status.HTTP_201_CREATED,
        )


class PublicLeadTrackAPIView(APIView):
    """Track all applications for a customer by PAN or mobile — no login required."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicLeadTrackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = LeadTrackService.track_applications(
                pan=serializer.validated_data.get("pan_no"),
                mobile=serializer.validated_data.get("mobile_number"),
                client_key=_client_key(request),
            )
        except LeadTrackError as exc:
            return error_response(
                message=exc.message,
                errors=exc.errors,
                status_code=exc.status_code,
            )
        message = (
            "Applications found"
            if payload.get("found") and payload.get("applications")
            else "No applications found for the details provided"
        )
        return success_response(data=payload, message=message)


class PublicLeadSourceListAPIView(APIView):
    """List intake source slugs for public lead forms (no authentication)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return success_response(data=LeadIntakeService.list_public_sources())
