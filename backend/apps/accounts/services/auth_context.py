from apps.accounts.selectors.permission_selectors import get_user_permission_codes, get_user_roles
from apps.accounts.services.role_helpers import (
    can_assign_roles,
    can_create_users,
    is_admin_user,
    is_super_admin,
)


def _profile(user):
    return getattr(user, "profile", None)


def build_auth_context(user) -> dict:
    permissions = sorted(get_user_permission_codes(user.id))
    roles = get_user_roles(user.id)
    super_admin = is_super_admin(user)
    admin = is_admin_user(user)
    profile = _profile(user)

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "middle_name": user.middle_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name() or user.email,
            "display_name": user.get_display_name(),
            "mobile_number": (profile.mobile_number if profile else "") or "",
            "employee_code": user.employee_code or "",
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "is_verified": user.is_verified,
            "must_change_password": user.must_change_password,
            "password_expires_at": (
                user.password_expires_at.isoformat() if user.password_expires_at else None
            ),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "roles": roles,
        "permissions": permissions,
        "access": {
            "is_super_admin": super_admin,
            "is_admin": admin and not super_admin,
            "can_edit": super_admin
            or (not admin and any(p.endswith(".update") for p in permissions)),
            "can_delete": super_admin or any(p.endswith(".delete") for p in permissions),
            "can_grant_permission": super_admin
            or ("permission.grant" in permissions and "permission.revoke" in permissions),
            "can_grant_delete_permission": super_admin,
            "can_create_user": can_create_users(user),
            "can_assign_roles": can_assign_roles(user),
            "can_approve_users": super_admin or "user.approve" in permissions,
        },
    }
