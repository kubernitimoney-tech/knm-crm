import pytest

from apps.accounts.models import Permission, PermissionAction, PermissionModule


@pytest.mark.django_db
class TestPermissionModel:
    def test_code_auto_generated(self):
        perm, _ = Permission.objects.get_or_create(
            module=PermissionModule.CUSTOMER,
            action=PermissionAction.VIEW,
        )
        assert perm.code == "customer.view"

    def test_unique_module_action(self):
        Permission.objects.get_or_create(
            module=PermissionModule.LOAN,
            action=PermissionAction.APPROVE,
        )
        with pytest.raises(Exception):
            Permission.objects.create(
                module=PermissionModule.LOAN,
                action=PermissionAction.APPROVE,
            )
