"""Roles admin list / role assignment directory endpoints."""

from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.accounts.services.permission_admin_service import RoleAdminService
from apps.core.responses import error_response, success_response


class RoleDirectoryAPIView(APIView):
    """Active roles with assignment and permission counts."""

    permission_classes = [HasRBACPermission]
    required_permission = "role.view"

    def get(self, request):
        data = RoleAdminService.list_roles()
        return success_response(data={"roles": data, "total": len(data)}, message="Roles")


class RoleAssigneesAPIView(APIView):
    """Users currently assigned to a role (role assignment directory)."""

    permission_classes = [HasRBACPermission]
    required_permissions = ["role.view", "user.view"]

    def get(self, request, role_slug):
        from apps.accounts.models import Role, RoleStatus

        if not Role.objects.filter(
            slug=role_slug, is_active=True, status=RoleStatus.ACTIVE
        ).exists():
            return error_response(message="Role not found", status_code=404)
        assignees = RoleAdminService.role_users(role_slug)
        return success_response(
            data={"role_slug": role_slug, "users": assignees, "total": len(assignees)},
            message="Role assignees",
        )
