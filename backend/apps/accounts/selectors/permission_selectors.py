from django.db.models import Prefetch

from apps.accounts.models import (
    Permission,
    PermissionStatus,
    RolePermission,
    RoleStatus,
    UserPermission,
    UserRole,
)


def get_user_permission_codes(user_id) -> set[str]:
    """
    Single optimized query path for RBAC resolution.
    Uses prefetch to avoid N+1 when traversing roles → permissions.
    Includes role-based and direct user grants.
    """
    user_roles = (
        UserRole.objects.filter(
            user_id=user_id,
            role__is_active=True,
            role__status=RoleStatus.ACTIVE,
        )
        .select_related("role")
        .prefetch_related(
            Prefetch(
                "role__role_permissions",
                queryset=RolePermission.objects.select_related("permission").filter(
                    permission__status=PermissionStatus.ACTIVE
                ),
            )
        )
    )
    codes = set()
    for ur in user_roles:
        for rp in ur.role.role_permissions.all():
            codes.add(rp.permission.code)

    direct_codes = UserPermission.objects.filter(
        user_id=user_id,
        is_active=True,
        permission__status=PermissionStatus.ACTIVE,
    ).values_list("permission__code", flat=True)
    codes.update(direct_codes)
    return codes


def get_user_roles(user_id) -> list[dict]:
    rows = (
        UserRole.objects.filter(
            user_id=user_id,
            role__is_active=True,
            role__status=RoleStatus.ACTIVE,
        )
        .select_related("role")
        .order_by("role__name")
        .values("role__slug", "role__name", "role__display_name")
    )
    return [
        {
            "slug": row["role__slug"],
            "name": row["role__name"],
            "display_name": row["role__display_name"] or row["role__name"],
        }
        for row in rows
    ]


def get_permissions_for_module(module: str):
    return Permission.objects.filter(
        module=module,
        status=PermissionStatus.ACTIVE,
    ).only("id", "code", "module", "action", "status")
