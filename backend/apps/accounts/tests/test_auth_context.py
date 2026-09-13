import pytest
from django.core.management import call_command
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import Role, UserRole
from apps.accounts.services.auth_context import build_auth_context


@pytest.mark.django_db
class TestAuthContext:
    def test_user_includes_employee_code(self):
        user = UserFactory()
        ctx = build_auth_context(user)
        assert ctx["user"]["employee_code"] == user.employee_code
        assert user.employee_code.startswith("KNM")

    def test_superuser_has_full_access_flags(self):
        user = UserFactory(is_superuser=True)
        ctx = build_auth_context(user)
        assert ctx["access"]["is_super_admin"] is True
        assert ctx["access"]["can_edit"] is True
        assert ctx["access"]["can_delete"] is True

    def test_admin_role_cannot_edit_or_delete(self):
        call_command("seed_permissions")
        user = UserFactory()
        admin_role = Role.objects.get(slug="admin")
        UserRole.objects.create(user=user, role=admin_role)
        ctx = build_auth_context(user)
        assert ctx["access"]["is_admin"] is True
        assert ctx["access"]["can_edit"] is False
        # Admin seed excludes most .delete codes but keeps audit.delete
        assert ctx["access"]["can_delete"] is True
        assert "audit.delete" in ctx["permissions"]
        assert ctx["access"]["can_grant_permission"] is True

    def test_user_with_module_delete_sees_can_delete(self):
        call_command("seed_permissions")
        user = UserFactory()
        grant_permission(user, "lead.delete")
        ctx = build_auth_context(user)
        assert ctx["access"]["can_delete"] is True
        assert "lead.delete" in ctx["permissions"]

    def test_rm_has_lead_view_permission(self):
        call_command("seed_permissions")
        user = UserFactory()
        rm_role = Role.objects.get(slug="relationship-manager")
        UserRole.objects.create(user=user, role=rm_role)
        ctx = build_auth_context(user)
        assert "lead.view" in ctx["permissions"]
        assert "lead.delete" not in ctx["permissions"]

    def test_direct_grant_included(self):
        call_command("seed_permissions")
        user = UserFactory()
        grant_permission(user, "application.approve")
        ctx = build_auth_context(user)
        assert "application.approve" in ctx["permissions"]
