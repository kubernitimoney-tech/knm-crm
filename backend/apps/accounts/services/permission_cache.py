"""
Redis-backed permission cache.

Key pattern: user:{user_id}:permissions
Value: set of permission codes (JSON list)

Invalidation strategy:
- On UserRole create/delete → invalidate that user
- On RolePermission create/delete → invalidate all users with that role
- On Role delete → invalidate all affected users
- Management command seed_permissions → flush pattern or full RBAC keys
"""

from django.conf import settings
from django.core.cache import cache

from apps.accounts.selectors.permission_selectors import get_user_permission_codes


def _cache_key(user_id) -> str:
    return f"{settings.RBAC_PERMISSION_CACHE_PREFIX}:{user_id}:permissions"


def get_cached_permissions(user_id) -> set[str] | None:
    cached = cache.get(_cache_key(user_id))
    if cached is None:
        return None
    return set(cached)


def set_cached_permissions(user_id, codes: set[str]) -> None:
    cache.set(
        _cache_key(user_id),
        list(codes),
        settings.RBAC_PERMISSION_CACHE_TTL,
    )


def invalidate_user_permissions(user_id) -> None:
    cache.delete(_cache_key(user_id))


def invalidate_role_users(role_id) -> None:
    from apps.accounts.models import UserRole

    user_ids = UserRole.objects.filter(role_id=role_id).values_list("user_id", flat=True)
    for uid in user_ids:
        invalidate_user_permissions(uid)


def resolve_user_permissions(user) -> set[str]:
    cached = get_cached_permissions(user.id)
    if cached is not None:
        return cached
    codes = get_user_permission_codes(user.id)
    set_cached_permissions(user.id, codes)
    return codes
