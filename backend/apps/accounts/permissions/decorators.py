"""Declarative RBAC helpers for DRF viewsets."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

F = TypeVar("F", bound=Callable)


def rbac_permission(code: str) -> Callable[[F], F]:
    """Require a single permission code for a view action."""

    def decorator(func: F) -> F:
        func.rbac_permission = code  # type: ignore[attr-defined]
        return func

    return decorator


def rbac_any_permission(*codes: str) -> Callable[[F], F]:
    """Require any one of the given permission codes for a view action."""

    def decorator(func: F) -> F:
        func.rbac_any_permissions = list(codes)  # type: ignore[attr-defined]
        return func

    return decorator


def require_rbac(
    view, request, *, permission: str | None = None, permissions: list[str] | None = None
) -> None:
    """
    Re-check RBAC inside an action when method-specific permissions differ
    (e.g. GET loan.view, POST loan.update on the same endpoint).

    Do not call ``view.check_permissions()``. That calls ``get_permissions()``,
    which replaces these codes with the action decorator's list.
    """
    from apps.accounts.permissions.rbac import HasRBACPermission

    view.required_permission = permission
    view.required_permissions = list(permissions) if permissions else None
    if not HasRBACPermission().has_permission(request, view):
        view.permission_denied(request)
