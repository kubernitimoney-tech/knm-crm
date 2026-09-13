from django.db import transaction

from apps.accounts.models import Role, RoleChangeRecord, RoleStatus, UserRole
from apps.accounts.services.permission_cache import invalidate_user_permissions
from apps.accounts.services.role_helpers import (
    SUPER_ADMIN_SLUG,
    actor_can_assign_role_slug,
    can_assign_roles,
    is_super_admin,
)
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService


class RoleServiceError(Exception):
    def __init__(self, message: str, *, requires_confirmation: bool = False):
        super().__init__(message)
        self.requires_confirmation = requires_confirmation


class RoleService:
    CONFIRMATION_MESSAGE = "Are you sure you want to proceed with this role change?"

    @classmethod
    def _validate_actor(cls, actor) -> None:
        if not can_assign_roles(actor):
            raise RoleServiceError("Only Super Admin and Admin can assign roles.")

    @classmethod
    def _get_role(cls, role_slug: str) -> Role:
        try:
            return Role.objects.get(slug=role_slug, is_active=True, status=RoleStatus.ACTIVE)
        except Role.DoesNotExist as exc:
            raise RoleServiceError(f"Unknown or inactive role: {role_slug}") from exc

    @classmethod
    def assign_role(
        cls,
        *,
        actor,
        target_user,
        role_slug: str,
        approval_email,
        confirm: bool = False,
        replace_existing: bool = True,
    ) -> UserRole:
        cls._validate_actor(actor)

        if not confirm:
            raise RoleServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise RoleServiceError("Approval email upload is required before assigning a role.")
        if not actor_can_assign_role_slug(actor, role_slug):
            raise RoleServiceError("You are not allowed to assign this role.")
        if role_slug == SUPER_ADMIN_SLUG and not is_super_admin(actor):
            raise RoleServiceError("Only Super Admin can assign the Super Admin role.")
        if (
            target_user.id == actor.id
            and role_slug == SUPER_ADMIN_SLUG
            and not is_super_admin(actor)
        ):
            raise RoleServiceError("You cannot elevate your own role to Super Admin.")

        role = cls._get_role(role_slug)

        with transaction.atomic():
            if replace_existing:
                existing = UserRole.objects.filter(user=target_user).select_related("role")
                for user_role in existing:
                    if user_role.role_id == role.id:
                        continue
                    RoleChangeRecord.objects.create(
                        user=target_user,
                        role=user_role.role,
                        action=RoleChangeRecord.Action.REVOKE,
                        performed_by=actor,
                        approval_email=approval_email,
                    )
                existing.exclude(role=role).delete()

            user_role, created = UserRole.objects.update_or_create(
                user=target_user,
                role=role,
                defaults={"assigned_by": actor},
            )
            if created or replace_existing:
                RoleChangeRecord.objects.create(
                    user=target_user,
                    role=role,
                    action=RoleChangeRecord.Action.ASSIGN,
                    performed_by=actor,
                    approval_email=approval_email,
                )
            invalidate_user_permissions(target_user.id)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.ASSIGN,
            description=(
                f"Assigned role {role_slug} to {getattr(target_user, 'email', target_user)}"
            ),
            metadata={
                "target_user_id": str(target_user.pk),
                "role_slug": role_slug,
            },
        )

        return user_role

    @classmethod
    def revoke_role(
        cls,
        *,
        actor,
        target_user,
        role_slug: str,
        approval_email,
        confirm: bool = False,
    ) -> None:
        cls._validate_actor(actor)

        if not confirm:
            raise RoleServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise RoleServiceError("Approval email upload is required before revoking a role.")

        role = cls._get_role(role_slug)

        with transaction.atomic():
            deleted, _ = UserRole.objects.filter(user=target_user, role=role).delete()
            if not deleted:
                raise RoleServiceError("User does not have this role.")

            RoleChangeRecord.objects.create(
                user=target_user,
                role=role,
                action=RoleChangeRecord.Action.REVOKE,
                performed_by=actor,
                approval_email=approval_email,
            )
            invalidate_user_permissions(target_user.id)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.REVOKE,
            description=(
                f"Revoked role {role_slug} from {getattr(target_user, 'email', target_user)}"
            ),
            metadata={
                "target_user_id": str(target_user.pk),
                "role_slug": role_slug,
            },
        )
