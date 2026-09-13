"""
RBAC permission flow:

1. View declares required_permission = "loan.approve" on permission_classes.
2. has_permission(): resolves user's permission set (Redis → DB) and checks code.
3. has_object_permission(): for object-level rules, combines RBAC with
   business relationships (loan owner via customer, RM, ops executive).

Superusers bypass all checks (break-glass / local admin only).
"""

from rest_framework.permissions import BasePermission

from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.accounts.services.role_helpers import is_super_admin


class IsSuperAdmin(BasePermission):
    """Only the Super Admin role (or Django superuser) may proceed."""

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return is_super_admin(request.user)


class HasRBACPermission(BasePermission):
    required_permission: str | None = None

    def get_required_permission(self, view):
        return getattr(view, "required_permission", None) or self.required_permission

    def get_required_permissions(self, view):
        return getattr(view, "required_permissions", None)

    def _user_has_permission(self, user, code: str) -> bool:
        """Honor the permission matrix: holding the code is enough (including *.delete)."""
        return code in resolve_user_permissions(user)

    def _user_has_any_required_permission(self, user, view) -> bool:
        alternatives = self.get_required_permissions(view)
        if alternatives:
            return any(self._user_has_permission(user, code) for code in alternatives)
        required = self.get_required_permission(view)
        if not required:
            return False
        return self._user_has_permission(user, required)

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return self._user_has_any_required_permission(request.user, view)

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        if not self._user_has_any_required_permission(request.user, view):
            return False
        return self._check_object_access(request, view, obj)

    def _check_object_access(self, request, view, obj):
        """Delegate to model-specific hooks when present."""
        checker = getattr(obj, "check_user_access", None)
        if callable(checker):
            return checker(request.user)
        return True


class LoanObjectPermission(HasRBACPermission):
    """
    Object-level loan access:
    - Customer-linked ownership (via application)
    - Assigned relationship manager
    - Assigned operations executive
    """

    def _check_object_access(self, request, view, obj):
        if not super()._check_object_access(request, view, obj):
            return False
        user = request.user
        loan = obj
        if hasattr(loan, "application"):
            app = loan.application
            if app.relationship_manager_id == user.id:
                return True
            if app.operations_executive_id == user.id:
                return True
            if app.created_by_id == user.id:
                return True
        return request.user.is_staff
