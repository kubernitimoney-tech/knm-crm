from rest_framework import viewsets

from apps.accounts.models import Role, RoleStatus
from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers import RoleSerializer


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.filter(is_active=True, status=RoleStatus.ACTIVE).prefetch_related(
        "role_permissions__permission"
    )
    serializer_class = RoleSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "role.view"
    lookup_field = "pk"
    lookup_value_regex = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

    def get_queryset(self):
        if self.action in ("list", "retrieve"):
            return Role.objects.filter(is_active=True, status=RoleStatus.ACTIVE).prefetch_related(
                "role_permissions__permission"
            )
        # Allow update/delete of soft-deleted rows by id when needed
        return Role.objects.all().prefetch_related("role_permissions__permission")

    def get_permissions(self):
        perms = {
            "list": "role.view",
            "retrieve": "role.view",
            "create": "role.create",
            "update": "role.update",
            "partial_update": "role.update",
            "destroy": "role.delete",
        }
        self.required_permission = perms.get(self.action, "role.view")
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(is_active=True)

    def perform_destroy(self, instance):
        # Soft delete: deactivate the role instead of removing the row so
        # existing assignments and audit history stay intact.
        instance.is_active = False
        instance.status = RoleStatus.INACTIVE
        instance.save(update_fields=["is_active", "status", "updated_at"])
