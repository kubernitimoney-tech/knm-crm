from apps.accounts.permissions import HasRBACPermission
from apps.accounts.services.role_helpers import is_admin_user, is_it_support, is_super_admin


class LeadObjectPermission(HasRBACPermission):
    """
    Object-level lead access:
    - Super Admin / Admin / IT Support: full access (RBAC still gates each action).
    - Otherwise the assigned RM, assigned CM, or creator (via Lead.check_user_access).
    """

    def _check_object_access(self, request, view, obj):
        user = request.user
        if is_super_admin(user) or is_admin_user(user) or is_it_support(user):
            return True
        if getattr(view, "action", None) == "transfer":
            return True
        return super()._check_object_access(request, view, obj)
