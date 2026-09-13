import pytest
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import Permission, PermissionAction, PermissionModule
from apps.accounts.services.permission_cache import resolve_user_permissions


@pytest.mark.django_db
class TestRBACPermissions:
    def test_user_permission_resolution(self):
        user = UserFactory()
        Permission.objects.get_or_create(
            module=PermissionModule.LOAN,
            action=PermissionAction.VIEW,
        )
        grant_permission(user, "loan.view")
        perms = resolve_user_permissions(user)
        assert "loan.view" in perms
