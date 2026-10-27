from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.accounts.models import User
from apps.accounts.permissions import HasRBACPermission
from apps.accounts.serializers.role_assignment_serializers import (
    AssignRoleSerializer,
    RevokeRoleSerializer,
    RoleChangeRecordSerializer,
    UserRoleSerializer,
)
from apps.accounts.serializers.user_serializers import (
    ApprovalDecisionSerializer,
    ApprovalResubmitSerializer,
    ResetPasswordSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.accounts.services.role_helpers import (
    can_create_users,
    get_assignable_role_slugs,
    is_super_admin,
)
from apps.accounts.services.role_service import RoleService, RoleServiceError
from apps.accounts.services.token_service import TokenService
from apps.accounts.services.user_onboarding_service import (
    UserOnboardingError,
    UserOnboardingService,
)
from apps.accounts.services.user_service import UserService, UserServiceError
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.core.responses import error_response, success_response
from apps.core.validators.email import validate_business_email


class UserViewSet(viewsets.ModelViewSet):
    """
    CRM users — list/retrieve/create/update/deactivate.

    New users are created inactive with a pending approval; a different user
    holding ``user.approve`` activates them. Role assignment actions require
    Super Admin or Admin with an approval attachment.
    """

    queryset = (
        User.objects.select_related(
            "profile__branch",
            "approval__created_by",
            "approval__approved_by",
            "created_by",
            "updated_by",
        )
        .all()
        .order_by("-created_at")
    )
    serializer_class = UserSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "user.view"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["employee_code", "email", "username", "first_name", "last_name"]
    filterset_fields = {
        "is_active": ["exact"],
        "is_verified": ["exact"],
        "approval__status": ["exact"],
    }

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action == "partial_update":
            return UserUpdateSerializer
        return UserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Approval evidence links are only handed out on the detail view.
        context["include_attachment_url"] = self.action in {
            "retrieve",
            "partial_update",
            "approve",
            "reject",
            "resubmit_approval",
        }
        return context

    def get_permissions(self):
        perms = {
            "list": "user.view",
            "retrieve": "user.view",
            "create": "user.create",
            "partial_update": "user.update",
            "destroy": "user.delete",
            "assign_role": "user.create",
            "revoke_role": "user.create",
            "role_history": "user.view",
            "assignable_roles": "user.view",
            "reset_password": "user.view",
            "username_suggestion": "user.create",
            "approve": "user.approve",
            "reject": "user.approve",
            "resubmit_approval": "user.create",
        }
        self.required_permission = perms.get(self.action, "user.view")
        return super().get_permissions()

    def _user_response(self, user, *, message, status_code=status.HTTP_200_OK, extra=None):
        user = self.get_queryset().get(pk=user.pk)
        data = UserSerializer(user, context=self.get_serializer_context()).data
        if extra:
            data = {**data, **extra}
        return success_response(data=data, message=message, status_code=status_code)

    def create(self, request, *args, **kwargs):
        if not can_create_users(request.user):
            return error_response(
                message="Only Super Admin and Admin can create users.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        serializer = UserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)

        data = serializer.validated_data
        try:
            user, temporary_password = UserOnboardingService.create_user(
                actor=request.user,
                email=data["email"],
                first_name=data["first_name"],
                middle_name=data.get("middle_name", ""),
                last_name=data.get("last_name", ""),
                display_name=data.get("display_name", ""),
                password=data.get("password", ""),
                mobile_number=data["mobile_number"],
                branch=data["branch"],
                address=data.get("address", ""),
                role_slug=data.get("role_slug") or None,
                attachment=data["attachment"],
                request_remarks=data["request_remarks"],
            )
        except UserOnboardingError as exc:
            return error_response(message=str(exc))

        # A generated temporary password is returned exactly once, to the creator.
        return self._user_response(
            user,
            message="User created and sent for approval",
            status_code=status.HTTP_201_CREATED,
            extra={"temporary_password": temporary_password},
        )

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = UserUpdateSerializer(
            user, data=request.data, partial=True, context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)
        serializer.save()
        UserActivityService.log(
            user=request.user,
            action=UserActivityAction.UPDATE,
            description=f"Updated CRM user {user.username} ({user.email})",
            metadata={
                "target_user_id": str(user.pk),
                "fields": sorted(serializer.validated_data),
            },
        )
        return self._user_response(user, message="User updated")

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return error_response(message="You cannot deactivate your own account.")
        # Soft delete: deactivate the account instead of removing the row,
        # preserving audit trails and referential integrity.
        with transaction.atomic():
            user.is_active = False
            user.updated_by = request.user
            user.save(update_fields=["is_active", "updated_by", "updated_at"])
            TokenService.invalidate_existing_sessions(user)
        UserActivityService.log(
            user=request.user,
            action=UserActivityAction.DELETE,
            description=f"Deactivated CRM user {user.username} ({user.email})",
            metadata={"target_user_id": str(user.pk)},
        )
        return success_response(message="User deactivated")

    @action(detail=False, methods=["get"], url_path="username-suggestion")
    def username_suggestion(self, request):
        try:
            email = validate_business_email(request.query_params.get("email", ""))
        except ValueError as exc:
            return error_response(message=str(exc))
        return success_response(
            data={"username": UserOnboardingService.suggest_username(email)},
            message="Username suggested",
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        return self._decide(request, UserOnboardingService.approve, "User approved and activated")

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        return self._decide(request, UserOnboardingService.reject, "User request rejected")

    def _decide(self, request, decision, message):
        user = self.get_object()
        serializer = ApprovalDecisionSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)
        try:
            decision(
                actor=request.user,
                user=user,
                remarks=serializer.validated_data.get("remarks", ""),
            )
        except UserOnboardingError as exc:
            return error_response(message=str(exc))
        return self._user_response(user, message=message)

    @action(
        detail=True,
        methods=["post"],
        url_path="resubmit-approval",
        parser_classes=[MultiPartParser, FormParser],
    )
    def resubmit_approval(self, request, pk=None):
        user = self.get_object()
        serializer = ApprovalResubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Invalid request", errors=serializer.errors)
        try:
            UserOnboardingService.resubmit(
                actor=request.user,
                user=user,
                attachment=serializer.validated_data["attachment"],
                request_remarks=serializer.validated_data["request_remarks"],
            )
        except UserOnboardingError as exc:
            return error_response(message=str(exc))
        return self._user_response(user, message="Request resubmitted for approval")

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
                message="Only Super Admin can reset user passwords.",
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
