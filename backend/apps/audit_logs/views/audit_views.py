from rest_framework import viewsets

from apps.accounts.permissions import HasRBACPermission
from apps.audit_logs.models import AuditLog
from apps.audit_logs.serializers.audit_serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user").order_by("-created_at")
    serializer_class = AuditLogSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "audit.view"
    filterset_fields = ["model_name", "action", "user"]
