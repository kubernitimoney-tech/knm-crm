"""Permission catalog and per-user inventory endpoints."""

from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers.permission_serializers import (
    CreatePermissionSerializer,
    UpdatePermissionSerializer,
)
from apps.accounts.services.permission_admin_service import (
    PermissionCatalogError,
    PermissionCatalogService,
    UserPermissionInventoryService,
)
from apps.core.responses import error_response, success_response


class PermissionCatalogAPIView(APIView):
    """Master list of every permission code in the system."""

    permission_classes = [HasRBACPermission]
    required_permission = "permission.view"

    def get_permissions(self):
        if self.request.method == "POST":
            self.required_permission = "permission.create"
        else:
            self.required_permission = "permission.view"
        return super().get_permissions()

    def get(self, request):
        module = request.query_params.get("module") or None
        search = request.query_params.get("search") or ""
        data = PermissionCatalogService.get_catalog(module=module, search=search)
        return success_response(data=data, message="Permission catalog")

    def post(self, request):
        serializer = CreatePermissionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Invalid request",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            row = PermissionCatalogService.create_permission(**serializer.validated_data)
        except PermissionCatalogError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return success_response(
            data=row,
            message=f"Permission {row['code']} created",
            status_code=status.HTTP_201_CREATED,
        )


class PermissionCatalogDetailAPIView(APIView):
    """Update or soft-delete a catalog permission by id."""

    permission_classes = [HasRBACPermission]
    required_permission = "permission.update"

    def get_permissions(self):
        if self.request.method == "DELETE":
            self.required_permission = "permission.delete"
        else:
            self.required_permission = "permission.update"
        return super().get_permissions()

    def patch(self, request, permission_id):
        serializer = UpdatePermissionSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                message="Invalid request",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not serializer.validated_data:
            return error_response(
                message="No fields to update",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            row = PermissionCatalogService.update_permission(
                permission_id=permission_id,
                **serializer.validated_data,
            )
        except PermissionCatalogError as exc:
            code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in str(exc).lower()
                else status.HTTP_400_BAD_REQUEST
            )
            return error_response(message=str(exc), status_code=code)
        return success_response(data=row, message=f"Permission {row['code']} updated")

    def delete(self, request, permission_id):
        try:
            row = PermissionCatalogService.delete_permission(permission_id=permission_id)
        except PermissionCatalogError as exc:
            code = (
                status.HTTP_404_NOT_FOUND
                if "not found" in str(exc).lower()
                else status.HTTP_400_BAD_REQUEST
            )
            return error_response(message=str(exc), status_code=code)
        return success_response(
            data=row,
            message=f"Permission {row['code']} deactivated",
        )


class UserPermissionInventoryAPIView(APIView):
    """Roles, role permissions, direct overrides, and effective permissions for a user."""

    permission_classes = [HasRBACPermission]
    required_permission = "user.view"

    def get(self, request, user_id):
        from apps.accounts.models import User

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return error_response(message="User not found", status_code=404)
        data = UserPermissionInventoryService.build(user)
        return success_response(data=data, message="User permission inventory")
