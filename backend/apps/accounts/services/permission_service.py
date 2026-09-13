from django.db import transaction

from apps.accounts.models import (
    Permission,
    PermissionChangeRecord,
    PermissionStatus,
    UserPermission,
)
from apps.accounts.services.permission_cache import invalidate_user_permissions
from apps.accounts.services.role_helpers import (
    can_manage_permissions,
    can_modify_delete_permissions,
    is_delete_permission_code,
    user_has_permission,
)
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService


class PermissionServiceError(Exception):
    def __init__(self, message: str, *, requires_confirmation: bool = False):
        super().__init__(message)
        self.requires_confirmation = requires_confirmation


class PermissionService:
    CONFIRMATION_MESSAGE = "Are you sure you want to proceed with this permission change?"

    @classmethod
    def _validate_actor(cls, actor, *, permission_code: str | None = None) -> None:
        if not can_manage_permissions(actor):
            raise PermissionServiceError("You are not allowed to manage permissions.")
        if (
            permission_code
            and is_delete_permission_code(permission_code)
            and not can_modify_delete_permissions(actor)
        ):
            raise PermissionServiceError("Only Super Admin can grant or revoke delete permissions.")

    @classmethod
    def _get_permission(cls, code: str) -> Permission:
        try:
            return Permission.objects.get(code=code, status=PermissionStatus.ACTIVE)
        except Permission.DoesNotExist as exc:
            raise PermissionServiceError(f"Unknown permission: {code}") from exc

    @classmethod
    def grant_permission(
        cls,
        *,
        actor,
        target_user,
        permission_code: str,
        approval_email,
        confirm: bool = False,
    ) -> UserPermission:
        cls._validate_actor(actor, permission_code=permission_code)
        permission = cls._get_permission(permission_code)

        if not confirm:
            raise PermissionServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise PermissionServiceError("Approval email upload is required before granting.")

        with transaction.atomic():
            user_perm, _created = UserPermission.objects.update_or_create(
                user=target_user,
                permission=permission,
                defaults={
                    "granted_by": actor,
                    "is_active": True,
                },
            )
            PermissionChangeRecord.objects.create(
                user=target_user,
                permission=permission,
                action=PermissionChangeRecord.Action.GRANT,
                performed_by=actor,
                approval_email=approval_email,
            )
            invalidate_user_permissions(target_user.id)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.GRANT,
            description=(
                f"Granted permission {permission_code} to "
                f"{getattr(target_user, 'email', target_user)}"
            ),
            metadata={
                "target_user_id": str(target_user.pk),
                "permission_code": permission_code,
            },
        )

        return user_perm

    @classmethod
    def revoke_permission(
        cls,
        *,
        actor,
        target_user,
        permission_code: str,
        approval_email,
        confirm: bool = False,
    ) -> None:
        cls._validate_actor(actor, permission_code=permission_code)
        permission = cls._get_permission(permission_code)

        if not confirm:
            raise PermissionServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise PermissionServiceError("Approval email upload is required before revoking.")

        with transaction.atomic():
            updated = UserPermission.objects.filter(
                user=target_user,
                permission=permission,
                is_active=True,
            ).update(is_active=False)
            if not updated:
                raise PermissionServiceError("Permission is not directly granted to this user.")

            PermissionChangeRecord.objects.create(
                user=target_user,
                permission=permission,
                action=PermissionChangeRecord.Action.REVOKE,
                performed_by=actor,
                approval_email=approval_email,
            )
            invalidate_user_permissions(target_user.id)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.REVOKE,
            description=(
                f"Revoked permission {permission_code} from "
                f"{getattr(target_user, 'email', target_user)}"
            ),
            metadata={
                "target_user_id": str(target_user.pk),
                "permission_code": permission_code,
            },
        )

    @classmethod
    def delete_permission_grant(cls, *, actor, user_permission_id) -> None:
        if not user_has_permission(actor, "permission.delete"):
            raise PermissionServiceError("You do not have permission to delete permission grants.")

        with transaction.atomic():
            try:
                user_perm = UserPermission.objects.select_related("user", "permission").get(
                    pk=user_permission_id
                )
            except UserPermission.DoesNotExist as exc:
                raise PermissionServiceError("Permission grant not found.") from exc

            target_user_id = user_perm.user_id
            permission_code = user_perm.permission.code
            target_email = getattr(user_perm.user, "email", str(target_user_id))
            # Soft delete: deactivate the grant instead of removing the row.
            user_perm.is_active = False
            user_perm.save(update_fields=["is_active"])
            invalidate_user_permissions(target_user_id)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.DELETE,
            description=f"Deleted permission grant {permission_code} for {target_email}",
            metadata={
                "user_permission_id": str(user_permission_id),
                "target_user_id": str(target_user_id),
                "permission_code": permission_code,
            },
        )
