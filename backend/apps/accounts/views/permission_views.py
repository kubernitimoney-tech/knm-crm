from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers.permission_serializers import (
    GrantPermissionSerializer,
    RevokePermissionSerializer,
    UserPermissionSerializer,
)
from apps.accounts.services.permission_service import PermissionService, PermissionServiceError
from apps.core.responses import error_response, success_response


class GrantPermissionAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "permission.grant"

    def post(self, request):
        serializer = GrantPermissionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            target_user = User.objects.get(pk=data["user_id"])
        except User.DoesNotExist:
            return error_response(message="User not found", status_code=status.HTTP_404_NOT_FOUND)

        try:
            user_perm = PermissionService.grant_permission(
                actor=request.user,
                target_user=target_user,
                permission_code=data["permission_code"],
                approval_email=data["approval_email"],
                confirm=data["confirm"],
            )
        except PermissionServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        return success_response(
            data=UserPermissionSerializer(user_perm).data,
            message="Permission granted",
            status_code=status.HTTP_201_CREATED,
        )


class RevokePermissionAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "permission.revoke"

    def post(self, request):
        serializer = RevokePermissionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            target_user = User.objects.get(pk=data["user_id"])
        except User.DoesNotExist:
            return error_response(message="User not found", status_code=status.HTTP_404_NOT_FOUND)

        try:
            PermissionService.revoke_permission(
                actor=request.user,
                target_user=target_user,
                permission_code=data["permission_code"],
                approval_email=data["approval_email"],
                confirm=data["confirm"],
            )
        except PermissionServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        return success_response(message="Permission revoked")


class DeletePermissionGrantAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "permission.delete"

    def delete(self, request, grant_id):
        try:
            PermissionService.delete_permission_grant(
                actor=request.user, user_permission_id=grant_id
            )
        except PermissionServiceError as exc:
            msg = str(exc)
            status_code = (
                status.HTTP_403_FORBIDDEN
                if "do not have permission" in msg.lower()
                else status.HTTP_404_NOT_FOUND
            )
            return error_response(message=msg, status_code=status_code)
        return success_response(message="Permission grant deleted")
