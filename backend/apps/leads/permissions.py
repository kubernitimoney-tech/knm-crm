from apps.accounts.permissions import HasRBACPermission
from apps.accounts.services.role_helpers import is_admin_user, is_super_admin


class LeadObjectPermission(HasRBACPermission):
    """
    Object-level lead access:
    - Super Admin / Admin: full access.
    - Otherwise the assigned RM, assigned CM, or creator (via Lead.check_user_access).
    """

    def _check_object_access(self, request, view, obj):
        user = request.user
        if is_super_admin(user) or is_admin_user(user):
            return True
        return super()._check_object_access(request, view, obj)
