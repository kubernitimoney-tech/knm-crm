"""Reusable DRF mixins for RBAC permission resolution."""

from __future__ import annotations


class RBACActionPermissionMixin:
    """
    Resolve required_permission / required_permissions from:
    1. @rbac_permission / @rbac_any_permission on the action handler
    2. rbac_crud_permissions class dict (standard ModelViewSet actions)
    3. rbac_default_permission class attribute
    """

    rbac_default_permission: str | None = None
    rbac_crud_permissions: dict[str, str] = {}

    def _rbac_action_handler(self):
        handler = getattr(self, self.action, None)
        if handler is None:
            return None
        return getattr(handler, "__func__", handler)

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions = None

        func = self._rbac_action_handler()
        if func is not None:
            any_perms = getattr(func, "rbac_any_permissions", None)
            if any_perms:
                self.required_permissions = list(any_perms)
            else:
                single = getattr(func, "rbac_permission", None)
                if single:
                    self.required_permission = single

        if self.required_permission is None and self.required_permissions is None:
            crud_perm = self.rbac_crud_permissions.get(self.action)
            if crud_perm:
                self.required_permission = crud_perm
            elif self.rbac_default_permission:
                self.required_permission = self.rbac_default_permission

        return super().get_permissions()
