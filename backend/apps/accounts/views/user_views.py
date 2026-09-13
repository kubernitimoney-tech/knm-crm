from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser

from apps.accounts.models import User
from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers.role_assignment_serializers import (
    AssignRoleSerializer,
    RevokeRoleSerializer,
    RoleChangeRecordSerializer,
    UserRoleSerializer,
)
from apps.accounts.serializers.user_serializers import (
    ResetPasswordSerializer,
    UserCreateSerializer,
    UserSerializer,
)
from apps.accounts.services.role_helpers import (
    can_create_users,
    get_assignable_role_slugs,
    is_super_admin,
)
from apps.accounts.services.role_service import RoleService, RoleServiceError
from apps.accounts.services.user_service import UserService, UserServiceError
from apps.core.responses import error_response, success_response


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD on users — list/retrieve/create/update/delete.
    Role assignment actions require Super Admin or Admin with approval attachment.
    """

    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "user.view"
    search_fields = ["employee_code", "email", "first_name", "last_name"]
    filterset_fields = ["is_active", "is_verified"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        perms = {
            "list": "user.view",
            "retrieve": "user.view",
            "create": "user.create",
            "update": "user.update",
            "partial_update": "user.update",
            "destroy": "user.delete",
            "assign_role": "user.create",
            "revoke_role": "user.create",
            "role_history": "user.view",
            "assignable_roles": "user.view",
            "reset_password": "user.view",
        }
        self.required_permission = perms.get(self.action, "user.view")
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        if not can_create_users(request.user):
            return error_response(
                message="Only Super Admin and Admin can create users.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Soft delete: deactivate the account instead of removing the row,
        # preserving audit trails and referential integrity.
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(
        detail=True,
        methods=["post"],
        url_path="assign-role",
        parser_classes=[MultiPartParser, FormParser],
    )
    def assign_role(self, request, pk=None):
        user = self.get_object()
        serializer = AssignRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            user_role = RoleService.assign_role(
                actor=request.user,
                target_user=user,
                role_slug=data["role_slug"],
                approval_email=data.get("approval_email"),
                confirm=data["confirm"],
                replace_existing=data.get("replace_existing", True),
            )
        except RoleServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        return success_response(
            data=UserRoleSerializer(user_role).data,
            message="Role assigned successfully",
            status_code=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="revoke-role",
        parser_classes=[MultiPartParser, FormParser],
    )
    def revoke_role(self, request, pk=None):
        user = self.get_object()
        serializer = RevokeRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            RoleService.revoke_role(
                actor=request.user,
                target_user=user,
                role_slug=data["role_slug"],
                approval_email=data.get("approval_email"),
                confirm=data["confirm"],
            )
        except RoleServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        return success_response(message="Role revoked successfully")

    @action(detail=True, methods=["get"], url_path="role-history")
    def role_history(self, request, pk=None):
        user = self.get_object()
        records = user.role_change_records.select_related("role", "performed_by").all()[:50]
        return success_response(
            data=RoleChangeRecordSerializer(records, many=True).data,
            message="Role history loaded",
        )

    @action(detail=False, methods=["get"], url_path="assignable-roles")
    def assignable_roles(self, request):
        slugs = sorted(get_assignable_role_slugs(request.user))
        from apps.accounts.models import Role, RoleStatus

        roles = Role.objects.filter(
            slug__in=slugs, is_active=True, status=RoleStatus.ACTIVE
        ).order_by("name")
        data = [
            {"slug": r.slug, "name": r.name, "display_name": r.get_display_name()} for r in roles
        ]
        return success_response(data=data, message="Assignable roles loaded")

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        if not is_super_admin(request.user):
            return error_response(
                message="Only Super Admin can reset employee passwords.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            new_password = UserService.reset_password(
                actor=request.user,
                target_user=user,
                password=data.get("password"),
                confirm=data["confirm"],
            )
        except UserServiceError as exc:
            if exc.requires_confirmation:
                return success_response(
                    data={"requires_confirmation": True},
                    message=str(exc),
                    status_code=status.HTTP_200_OK,
                )
            return error_response(message=str(exc))

        return success_response(
            data={"temporary_password": new_password},
            message="Password reset successfully",
        )
