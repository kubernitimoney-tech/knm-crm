from rest_framework import viewsets
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.audit_logs.models import UserActivityLog
from apps.audit_logs.serializers.user_activity_serializers import (
    LogUserActivitySerializer,
    UserActivityLogSerializer,
)
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.core.responses import success_response


class UserActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UserActivityLog.objects.select_related("user").order_by("-created_at")
    serializer_class = UserActivityLogSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "audit.view"
    filterset_fields = ["action", "user"]


class LogUserActivityAPIView(APIView):
    """Record a user-initiated action such as data export (client-side events)."""

    def post(self, request):
        serializer = LogUserActivitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = UserActivityService.log(
            user=request.user,
            action=serializer.validated_data["action"],
            description=serializer.validated_data["description"],
            metadata=serializer.validated_data.get("metadata") or {},
        )
        return success_response(
            data=UserActivityLogSerializer(row).data,
            message="Activity logged",
            status_code=201,
        )
