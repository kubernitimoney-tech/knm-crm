"""Permission catalog and per-user permission inventory."""

from __future__ import annotations

from django.db.models import Count, Prefetch, Q

from apps.accounts.models import (
    Permission,
    PermissionAction,
    PermissionChangeRecord,
    PermissionModule,
    PermissionStatus,
    Role,
    RolePermission,
    RoleStatus,
    UserPermission,
    UserRole,
)
from apps.accounts.services.role_helpers import SUPER_ADMIN_SLUG, is_delete_permission_code
from apps.accounts.services.role_permission_service import ACTION_LABELS, MODULE_DISPLAY_ORDER


class PermissionCatalogError(Exception):
    pass


class PermissionCatalogService:
    @classmethod
    def _permission_row(
        cls, permission: Permission, role_counts: dict, user_grant_counts: dict
    ) -> dict:
        return {
            "id": str(permission.id),
            "code": permission.code,
            "module": permission.module,
            "action": permission.action,
            "action_label": ACTION_LABELS.get(permission.action, permission.action),
            "name": f"{ACTION_LABELS.get(permission.action, permission.action)} "
            f"{dict(PermissionModule.choices).get(permission.module, permission.module)}",
            "status": permission.status,
            "is_critical": is_delete_permission_code(permission.code),
            "role_count": role_counts.get(permission.id, 0),
            "direct_grant_count": user_grant_counts.get(permission.id, 0),
        }

    @classmethod
    def get_catalog(cls, *, module: str | None = None, search: str = "") -> dict:
        # All statuses; ascending by code for a stable inventory order.
        qs = Permission.objects.all().order_by("code")
        if module:
            qs = qs.filter(module=module)
        search = (search or "").strip()
        if search:
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(module__icontains=search)
                | Q(action__icontains=search)
            )

        role_counts = {
            row["permission_id"]: row["c"]
            for row in RolePermission.objects.values("permission_id").annotate(c=Count("id"))
        }
        user_grant_counts = {
            row["permission_id"]: row["c"]
            for row in UserPermission.objects.filter(is_active=True)
            .values("permission_id")
            .annotate(c=Count("id"))
        }

        modules_by_key: dict[str, list] = {m.value: [] for m in MODULE_DISPLAY_ORDER}
        for permission in qs:
            modules_by_key.setdefault(permission.module, []).append(
                cls._permission_row(permission, role_counts, user_grant_counts)
            )

        module_labels = dict(PermissionModule.choices)
        modules_payload = []
        total = 0
        # Module groups alphabetically by label; permissions already in code ASC.
        for module_key in sorted(
            modules_by_key.keys(),
            key=lambda key: module_labels.get(key, key).lower(),
        ):
            items = modules_by_key.get(module_key, [])
            if not items:
                continue
            items.sort(key=lambda row: row["code"])
            total += len(items)
            modules_payload.append(
                {
                    "module": module_key,
                    "name": module_labels.get(module_key, module_key),
                    "permissions": items,
                    "count": len(items),
                }
            )

        modules_payload.sort(key=lambda m: m["name"].lower())

        return {
            "modules": modules_payload,
            "total_permissions": total,
            "actions": [{"value": a.value, "label": a.label} for a in PermissionAction],
            "module_options": sorted(
                [{"value": m.value, "label": m.label} for m in PermissionModule],
                key=lambda o: o["label"].lower(),
            ),
            "status_options": [{"value": s.value, "label": s.label} for s in PermissionStatus],
        }

    @classmethod
    def create_permission(
        cls,
        *,
        module: str,
        action: str,
        status: str = PermissionStatus.ACTIVE,
    ) -> dict:
        module = (module or "").strip()
        action = (action or "").strip()
        status = (status or PermissionStatus.ACTIVE).strip()

        if module not in PermissionModule.values:
            raise PermissionCatalogError(f"Invalid module: {module}")
        if action not in PermissionAction.values:
            raise PermissionCatalogError(f"Invalid action: {action}")
        if status not in PermissionStatus.values:
            raise PermissionCatalogError(f"Invalid status: {status}")

        if Permission.objects.filter(module=module, action=action).exists():
            code = f"{module}.{action}"
            raise PermissionCatalogError(f"Permission already exists: {code}")

        permission = Permission.objects.create(
            module=module,
            action=action,
            status=status,
        )
        return cls._permission_row(permission, {}, {})

    @classmethod
    def _get_permission(cls, permission_id) -> Permission:
        try:
            return Permission.objects.get(pk=permission_id)
        except (Permission.DoesNotExist, ValueError, TypeError) as exc:
            raise PermissionCatalogError("Permission not found") from exc

    @classmethod
    def _invalidate_users_for_permission(cls, permission_id) -> None:
        from apps.accounts.services.permission_cache import invalidate_user_permissions

        role_ids = RolePermission.objects.filter(permission_id=permission_id).values_list(
            "role_id", flat=True
        )
        user_ids = set(
            UserRole.objects.filter(role_id__in=role_ids).values_list("user_id", flat=True)
        )
        user_ids.update(
            UserPermission.objects.filter(permission_id=permission_id).values_list(
                "user_id", flat=True
            )
        )
        for uid in user_ids:
            invalidate_user_permissions(uid)

    @classmethod
    def update_permission(
        cls,
        *,
        permission_id,
        module: str | None = None,
        action: str | None = None,
        status: str | None = None,
    ) -> dict:
        permission = cls._get_permission(permission_id)

        new_module = (module if module is not None else permission.module).strip()
        new_action = (action if action is not None else permission.action).strip()
        new_status = (status if status is not None else permission.status).strip()

        if new_module not in PermissionModule.values:
            raise PermissionCatalogError(f"Invalid module: {new_module}")
        if new_action not in PermissionAction.values:
            raise PermissionCatalogError(f"Invalid action: {new_action}")
        if new_status not in PermissionStatus.values:
            raise PermissionCatalogError(f"Invalid status: {new_status}")

        clash = (
            Permission.objects.filter(module=new_module, action=new_action)
            .exclude(pk=permission.pk)
            .exists()
        )
        if clash:
            raise PermissionCatalogError(f"Permission already exists: {new_module}.{new_action}")

        code_changed = permission.module != new_module or permission.action != new_action
        status_changed = permission.status != new_status
        permission.module = new_module
        permission.action = new_action
        permission.status = new_status
        permission.save()

        if code_changed or status_changed:
            cls._invalidate_users_for_permission(permission.id)

        role_counts = {
            row["permission_id"]: row["c"]
            for row in RolePermission.objects.filter(permission_id=permission.id)
            .values("permission_id")
            .annotate(c=Count("id"))
        }
        user_grant_counts = {
            row["permission_id"]: row["c"]
            for row in UserPermission.objects.filter(permission_id=permission.id, is_active=True)
            .values("permission_id")
            .annotate(c=Count("id"))
        }
        return cls._permission_row(permission, role_counts, user_grant_counts)

    @classmethod
    def delete_permission(cls, *, permission_id) -> dict:
        """Soft-delete: mark inactive so role/user links remain for audit."""
        permission = cls._get_permission(permission_id)
        if permission.status == PermissionStatus.INACTIVE:
            raise PermissionCatalogError(f"Permission {permission.code} is already inactive")

        permission.status = PermissionStatus.INACTIVE
        permission.save(update_fields=["status"])
        cls._invalidate_users_for_permission(permission.id)
        return {
            "id": str(permission.id),
            "code": permission.code,
            "status": permission.status,
        }


class UserPermissionInventoryService:
    """Roles, role permissions, direct overrides, and effective codes for one user."""

    @classmethod
    def build(cls, user) -> dict:
        user_roles = (
            UserRole.objects.filter(
                user_id=user.id, role__is_active=True, role__status=RoleStatus.ACTIVE
            )
            .select_related("role", "assigned_by")
            .prefetch_related(
                Prefetch(
                    "role__role_permissions",
                    queryset=RolePermission.objects.select_related("permission"),
                )
            )
            .order_by("role__name")
        )

        role_payload = []
        role_codes: set[str] = set()
        code_sources: dict[str, list[str]] = {}

        for ur in user_roles:
            role = ur.role
            codes = sorted({rp.permission.code for rp in role.role_permissions.all()})
            for code in codes:
                role_codes.add(code)
                code_sources.setdefault(code, []).append(f"role:{role.slug}")
            role_payload.append(
                {
                    "slug": role.slug,
                    "name": role.name,
                    "display_name": role.get_display_name(),
                    "assigned_at": ur.assigned_at.isoformat() if ur.assigned_at else None,
                    "assigned_by_name": (
                        ur.assigned_by.get_full_name() or ur.assigned_by.email
                        if ur.assigned_by_id
                        else None
                    ),
                    "permission_codes": codes,
                    "permission_count": len(codes),
                    "is_locked": role.slug == SUPER_ADMIN_SLUG,
                }
            )

        direct_grants = (
            UserPermission.objects.filter(user_id=user.id, is_active=True)
            .select_related("permission", "granted_by")
            .order_by("permission__code")
        )
        overrides = []
        override_codes: set[str] = set()
        for grant in direct_grants:
            code = grant.permission.code
            override_codes.add(code)
            code_sources.setdefault(code, []).append("override")
            overrides.append(
                {
                    "id": str(grant.id),
                    "permission_id": str(grant.permission_id),
                    "permission_code": code,
                    "module": grant.permission.module,
                    "action": grant.permission.action,
                    "is_critical": is_delete_permission_code(code),
                    "granted_at": grant.granted_at.isoformat() if grant.granted_at else None,
                    "granted_by_name": (
                        grant.granted_by.get_full_name() or grant.granted_by.email
                        if grant.granted_by_id
                        else None
                    ),
                    "also_from_role": code in role_codes,
                }
            )

        effective = sorted(role_codes | override_codes)
        effective_rows = [
            {
                "code": code,
                "sources": code_sources.get(code, []),
                "from_role": code in role_codes,
                "from_override": code in override_codes,
            }
            for code in effective
        ]

        history = (
            PermissionChangeRecord.objects.filter(user_id=user.id)
            .select_related("permission", "performed_by")
            .order_by("-created_at")[:40]
        )
        history_payload = [
            {
                "id": str(rec.id),
                "action": rec.action,
                "permission_code": rec.permission.code,
                "performed_by_name": (
                    rec.performed_by.get_full_name() or rec.performed_by.email
                    if rec.performed_by_id
                    else None
                ),
                "created_at": rec.created_at.isoformat(),
                "approval_email_url": rec.approval_email.url if rec.approval_email else None,
            }
            for rec in history
        ]

        return {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.get_full_name() or user.email,
                "employee_code": user.employee_code or "",
                "is_active": user.is_active,
            },
            "roles": role_payload,
            "overrides": overrides,
            "effective_permissions": effective_rows,
            "effective_count": len(effective),
            "role_permission_count": len(role_codes),
            "override_count": len(override_codes),
            "history": history_payload,
        }


class RoleAdminService:
    @classmethod
    def list_roles(cls) -> list[dict]:
        roles = (
            Role.objects.filter(is_active=True, status=RoleStatus.ACTIVE)
            .annotate(
                permission_count=Count("role_permissions", distinct=True),
                user_count=Count("user_roles", distinct=True),
            )
            .order_by("name")
        )
        return [
            {
                "id": str(role.id),
                "slug": role.slug,
                "name": role.name,
                "display_name": role.get_display_name(),
                "description": role.description or "",
                "is_active": role.is_active,
                "status": role.status,
                "is_locked": role.slug == SUPER_ADMIN_SLUG,
                "permission_count": role.permission_count,
                "user_count": role.user_count,
                "created_at": role.created_at.isoformat() if role.created_at else None,
            }
            for role in roles
        ]

    @classmethod
    def role_users(cls, role_slug: str) -> list[dict]:
        rows = (
            UserRole.objects.filter(
                role__slug=role_slug, role__is_active=True, role__status=RoleStatus.ACTIVE
            )
            .select_related("user", "assigned_by")
            .order_by("user__first_name", "user__last_name", "user__email")
        )
        return [
            {
                "user_id": str(ur.user_id),
                "email": ur.user.email,
                "full_name": ur.user.get_full_name() or ur.user.email,
                "employee_code": ur.user.employee_code or "",
                "is_active": ur.user.is_active,
                "assigned_at": ur.assigned_at.isoformat() if ur.assigned_at else None,
                "assigned_by_name": (
                    ur.assigned_by.get_full_name() or ur.assigned_by.email
                    if ur.assigned_by_id
                    else None
                ),
            }
            for ur in rows
        ]
