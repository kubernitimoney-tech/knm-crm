from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers.role_permission_serializers import (
    RolePermissionChangeRecordSerializer,
    RolePermissionChangeSerializer,
)
from apps.accounts.services.role_permission_service import (
    RolePermissionService,
    RolePermissionServiceError,
)
from apps.core.responses import error_response, success_response


class PermissionMatrixAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "permission.view"

    def get(self, request):
        data = RolePermissionService.get_matrix()
        return success_response(data=data, message="Permission matrix loaded")


class PermissionMatrixAuditAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "permission.view"

    def get(self, request):
        limit = min(int(request.query_params.get("limit", 50)), 100)
        records = RolePermissionService.list_audit_records(limit=limit)
        serializer = RolePermissionChangeRecordSerializer(
            records,
            many=True,
            context={"request": request},
        )
        return success_response(data=serializer.data, message="Permission audit logs loaded")


class GrantRolePermissionAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "permission.grant"

    def post(self, request, role_slug):
        serializer = RolePermissionChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            RolePermissionService.grant_permission(
                actor=request.user,
                role_slug=role_slug,
                permission_code=data["permission_code"],
                approval_email=data.get("approval_email"),
                confirm=data["confirm"],
            )
        except RolePermissionServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        matrix = RolePermissionService.get_matrix()
        return success_response(
            data=matrix,
            message="Permission granted to role",
            status_code=status.HTTP_200_OK,
        )


class RevokeRolePermissionAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "permission.revoke"

    def post(self, request, role_slug):
        serializer = RolePermissionChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            RolePermissionService.revoke_permission(
                actor=request.user,
                role_slug=role_slug,
                permission_code=data["permission_code"],
                approval_email=data.get("approval_email"),
                confirm=data["confirm"],
            )
        except RolePermissionServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        matrix = RolePermissionService.get_matrix()
        return success_response(
            data=matrix,
            message="Permission revoked from role",
            status_code=status.HTTP_200_OK,
        )
