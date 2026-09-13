from django.db import transaction

from apps.accounts.models import (
    Permission,
    PermissionAction,
    PermissionModule,
    PermissionStatus,
    Role,
    RolePermission,
    RolePermissionChangeRecord,
    RoleStatus,
)
from apps.accounts.services.role_helpers import (
    SUPER_ADMIN_SLUG,
    can_manage_permissions,
    can_modify_delete_permissions,
    is_delete_permission_code,
)
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService

MODULE_DISPLAY_ORDER = [
    PermissionModule.USER,
    PermissionModule.ROLE,
    PermissionModule.CUSTOMER,
    PermissionModule.LEAD,
    PermissionModule.APPLICATION,
    PermissionModule.SANCTION,
    PermissionModule.DISBURSAL,
    PermissionModule.LOAN,
    PermissionModule.DOCUMENT,
    PermissionModule.ADDRESS,
    PermissionModule.COMPANY,
    PermissionModule.REFERENCE,
    PermissionModule.WORKFLOW,
    PermissionModule.CALL_LOG,
    PermissionModule.FIELD_INVESTIGATION,
    PermissionModule.COLLECTION,
    PermissionModule.REDFLAG,
    PermissionModule.DASHBOARD,
    PermissionModule.REPORT,
    PermissionModule.PERMISSION,
    PermissionModule.AUDIT,
]

ACTION_LABELS = {choice.value: choice.label for choice in PermissionAction}


class RolePermissionServiceError(Exception):
    def __init__(self, message: str, *, requires_confirmation: bool = False):
        super().__init__(message)
        self.requires_confirmation = requires_confirmation


class RolePermissionService:
    CONFIRMATION_MESSAGE = "Are you sure you want to proceed with this permission change?"

    @staticmethod
    def _permission_label(permission: Permission) -> str:
        action_label = ACTION_LABELS.get(permission.action, permission.action.title())
        module_label = dict(PermissionModule.choices).get(permission.module, permission.module)
        return f"{action_label} {module_label}"

    @classmethod
    def _validate_actor(cls, actor, *, permission_code: str) -> None:
        if not can_manage_permissions(actor):
            raise RolePermissionServiceError("You are not allowed to manage permissions.")
        if is_delete_permission_code(permission_code) and not can_modify_delete_permissions(actor):
            raise RolePermissionServiceError(
                "Only Super Admin can grant or revoke delete permissions."
            )

    @classmethod
    def _get_role(cls, role_slug: str) -> Role:
        if role_slug == SUPER_ADMIN_SLUG:
            raise RolePermissionServiceError(
                "Super Admin role permissions are locked and cannot be modified."
            )
        try:
            return Role.objects.get(slug=role_slug, is_active=True, status=RoleStatus.ACTIVE)
        except Role.DoesNotExist as exc:
            raise RolePermissionServiceError(f"Unknown or inactive role: {role_slug}") from exc

    @classmethod
    def _get_permission(cls, permission_code: str) -> Permission:
        try:
            return Permission.objects.get(code=permission_code, status=PermissionStatus.ACTIVE)
        except Permission.DoesNotExist as exc:
            raise RolePermissionServiceError(f"Unknown permission: {permission_code}") from exc

    @classmethod
    def get_matrix(cls) -> dict:
        permissions = list(
            Permission.objects.filter(status=PermissionStatus.ACTIVE).order_by("module", "action")
        )
        all_codes = {p.code for p in permissions}

        roles = (
            Role.objects.filter(is_active=True, status=RoleStatus.ACTIVE)
            .prefetch_related("role_permissions__permission")
            .order_by("name")
        )

        role_permission_map: dict[str, set[str]] = {}
        for role in roles:
            if role.slug == SUPER_ADMIN_SLUG:
                role_permission_map[role.slug] = set(all_codes)
            else:
                role_permission_map[role.slug] = {
                    rp.permission.code for rp in role.role_permissions.all()
                }

        modules_by_key: dict[str, list] = {m.value: [] for m in MODULE_DISPLAY_ORDER}
        for permission in permissions:
            modules_by_key.setdefault(permission.module, []).append(
                {
                    "id": str(permission.id),
                    "code": permission.code,
                    "module": permission.module,
                    "action": permission.action,
                    "action_label": ACTION_LABELS.get(permission.action, permission.action),
                    "name": cls._permission_label(permission),
                    "description": permission.description
                    or f"Allow {permission.action} access within {permission.module}.",
                    "is_critical": is_delete_permission_code(permission.code),
                }
            )

        module_payload = []
        module_labels = dict(PermissionModule.choices)
        for module in MODULE_DISPLAY_ORDER:
            items = modules_by_key.get(module.value, [])
            if not items:
                continue
            module_payload.append(
                {
                    "module": module.value,
                    "name": module_labels.get(module.value, module.value),
                    "description": f"Permissions for {module_labels.get(module.value, module.value)}.",
                    "permissions": items,
                }
            )

        role_payload = []
        for role in roles:
            codes = role_permission_map.get(role.slug, set())
            role_payload.append(
                {
                    "id": str(role.id),
                    "slug": role.slug,
                    "name": role.name,
                    "display_name": role.get_display_name(),
                    "description": role.description or "",
                    "is_locked": role.slug == SUPER_ADMIN_SLUG,
                    "permission_codes": sorted(codes),
                    "granted_count": len(codes),
                }
            )

        return {
            "modules": module_payload,
            "roles": role_payload,
            "total_permissions": len(permissions),
        }

    @classmethod
    def list_audit_records(cls, *, limit: int = 50) -> list[RolePermissionChangeRecord]:
        return list(
            RolePermissionChangeRecord.objects.select_related(
                "role", "permission", "performed_by"
            ).order_by("-created_at")[:limit]
        )

    @classmethod
    @transaction.atomic
    def grant_permission(
        cls,
        *,
        actor,
        role_slug: str,
        permission_code: str,
        approval_email,
        confirm: bool = False,
    ) -> RolePermission:
        cls._validate_actor(actor, permission_code=permission_code)

        if not confirm:
            raise RolePermissionServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise RolePermissionServiceError(
                "Approval email upload is required before granting a permission."
            )

        role = cls._get_role(role_slug)
        permission = cls._get_permission(permission_code)

        role_perm, created = RolePermission.objects.get_or_create(role=role, permission=permission)
        if not created:
            raise RolePermissionServiceError("Role already has this permission.")

        RolePermissionChangeRecord.objects.create(
            role=role,
            permission=permission,
            action=RolePermissionChangeRecord.Action.GRANT,
            performed_by=actor,
            approval_email=approval_email,
        )
        UserActivityService.log(
            user=actor,
            action=UserActivityAction.GRANT,
            description=f"Granted permission {permission_code} to role {role_slug}",
            metadata={"role_slug": role_slug, "permission_code": permission_code},
        )
        return role_perm

    @classmethod
    @transaction.atomic
    def revoke_permission(
        cls,
        *,
        actor,
        role_slug: str,
        permission_code: str,
        approval_email,
        confirm: bool = False,
    ) -> None:
        cls._validate_actor(actor, permission_code=permission_code)

        if not confirm:
            raise RolePermissionServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if not approval_email:
            raise RolePermissionServiceError(
                "Approval email upload is required before revoking a permission."
            )

        role = cls._get_role(role_slug)
        permission = cls._get_permission(permission_code)

        deleted, _ = RolePermission.objects.filter(role=role, permission=permission).delete()
        if not deleted:
            raise RolePermissionServiceError("Role does not have this permission.")

        RolePermissionChangeRecord.objects.create(
            role=role,
            permission=permission,
            action=RolePermissionChangeRecord.Action.REVOKE,
            performed_by=actor,
            approval_email=approval_email,
        )
        UserActivityService.log(
            user=actor,
            action=UserActivityAction.REVOKE,
            description=f"Revoked permission {permission_code} from role {role_slug}",
            metadata={"role_slug": role_slug, "permission_code": permission_code},
        )
