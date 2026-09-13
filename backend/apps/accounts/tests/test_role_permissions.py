import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import (
    Permission,
    PermissionAction,
    PermissionModule,
    Role,
    UserPermission,
    UserRole,
)
from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.accounts.services.permission_service import PermissionService, PermissionServiceError
from apps.accounts.services.role_helpers import can_delete_data, is_super_admin


@pytest.mark.django_db
class TestRoleMatrix:
    def test_auditor_is_view_only(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        role = Role.objects.get(slug="auditor")
        codes = {rp.permission.code for rp in role.role_permissions.select_related("permission")}
        assert codes
        assert all(code.endswith(".view") for code in codes)

    def test_admin_has_basic_update_not_lifecycle_mutations(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        role = Role.objects.get(slug="admin")
        codes = {rp.permission.code for rp in role.role_permissions.select_related("permission")}
        assert "user.create" in codes
        assert "permission.grant" in codes
        assert "lead.update" in codes
        assert "application.update" in codes
        assert "loan.update" not in codes
        assert "collection.update" not in codes
        delete_codes = {code for code in codes if code.endswith(".delete")}
        assert delete_codes == {"audit.delete"}

    def test_production_manager_excludes_user_and_permission_admin(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        admin_codes = {
            rp.permission.code
            for rp in Role.objects.get(slug="admin").role_permissions.select_related("permission")
        }
        production_codes = {
            rp.permission.code
            for rp in Role.objects.get(slug="production-manager").role_permissions.select_related(
                "permission"
            )
        }
        excluded = {
            "user.create",
            "user.update",
            "permission.view",
            "permission.create",
            "permission.update",
            "permission.grant",
            "permission.revoke",
        }
        assert production_codes == admin_codes - excluded
        assert excluded.isdisjoint(production_codes)
        # PM still has operational access shared with admin.
        assert "lead.view" in production_codes
        assert "application.approve" in production_codes
        assert "user.view" in production_codes

    def test_credit_manager_has_sanction(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        role = Role.objects.get(slug="credit-manager")
        codes = {rp.permission.code for rp in role.role_permissions.select_related("permission")}
        assert "application.sanction" in codes
        assert "application.approve" in codes
        assert "application.reject" in codes
        assert "disbursal.send" in codes
        assert "loan.view" in codes
        assert "call_log.view" in codes
        assert "call_log.create" in codes
        assert "document.upload" in codes
        assert "document.reupload" in codes
        assert "address.update" in codes
        assert "company.update" in codes
        assert "reference.update" in codes

    def test_relationship_manager_is_call_log_focused(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        role = Role.objects.get(slug="relationship-manager")
        codes = {rp.permission.code for rp in role.role_permissions.select_related("permission")}
        assert "lead.view" in codes
        assert "call_log.create" in codes
        assert "document.upload" not in codes
        assert "application.submit" not in codes


@pytest.mark.django_db
class TestDirectPermissionGrant:
    def test_grant_requires_confirmation_then_succeeds(self):
        from django.core.management import call_command

        call_command("seed_permissions")
        admin = UserFactory()
        target = UserFactory()
        grant_permission(admin, "permission.grant")
        grant_permission(admin, "permission.revoke")

        with pytest.raises(PermissionServiceError) as exc:
            PermissionService.grant_permission(
                actor=admin,
                target_user=target,
                permission_code="application.approve",
                approval_email=None,
                confirm=False,
            )
        assert exc.value.requires_confirmation

        approval = SimpleUploadedFile("approval.eml", b"approved", content_type="message/rfc822")
        user_perm = PermissionService.grant_permission(
            actor=admin,
            target_user=target,
            permission_code="application.approve",
            approval_email=approval,
            confirm=True,
        )
        assert user_perm.is_active
        assert "application.approve" in resolve_user_permissions(target)

    def test_only_super_admin_can_delete_grants(self):
        Permission.objects.get_or_create(module=PermissionModule.LOAN, action=PermissionAction.VIEW)
        Permission.objects.get_or_create(
            module=PermissionModule.PERMISSION, action=PermissionAction.DELETE
        )
        admin = UserFactory()
        super_admin = UserFactory()
        role, _ = Role.objects.get_or_create(slug="super-admin", defaults={"name": "Super Admin"})
        UserRole.objects.create(user=super_admin, role=role)

        assert not can_delete_data(admin)
        assert can_delete_data(super_admin)
        assert is_super_admin(super_admin)

        target = UserFactory()
        grant = UserPermission.objects.create(
            user=target,
            permission=Permission.objects.get(code="loan.view"),
            granted_by=super_admin,
        )

        with pytest.raises(PermissionServiceError):
            PermissionService.delete_permission_grant(actor=admin, user_permission_id=grant.id)

        PermissionService.delete_permission_grant(actor=super_admin, user_permission_id=grant.id)
        grant.refresh_from_db()
        assert grant.is_active is False

    def test_user_with_permission_delete_can_delete_grants(self):
        Permission.objects.get_or_create(module=PermissionModule.LOAN, action=PermissionAction.VIEW)
        perm_delete, _ = Permission.objects.get_or_create(
            module=PermissionModule.PERMISSION, action=PermissionAction.DELETE
        )
        actor = UserFactory()
        UserPermission.objects.create(user=actor, permission=perm_delete, granted_by=actor)

        target = UserFactory()
        grant = UserPermission.objects.create(
            user=target,
            permission=Permission.objects.get(code="loan.view"),
            granted_by=actor,
        )

        PermissionService.delete_permission_grant(actor=actor, user_permission_id=grant.id)
        grant.refresh_from_db()
        assert grant.is_active is False

    def test_only_super_admin_can_grant_delete_permissions(self):
        from django.core.management import call_command

        from apps.accounts.services.role_permission_service import (
            RolePermissionService,
            RolePermissionServiceError,
        )

        call_command("seed_permissions")
        admin = UserFactory()
        prod_manager = UserFactory()
        super_admin = UserFactory()
        UserRole.objects.create(user=admin, role=Role.objects.get(slug="admin"))
        UserRole.objects.create(user=prod_manager, role=Role.objects.get(slug="production-manager"))
        UserRole.objects.create(user=super_admin, role=Role.objects.get(slug="super-admin"))
        # Give production manager grant/revoke (normally seeded without them).
        grant_permission(prod_manager, "permission.grant")
        grant_permission(prod_manager, "permission.revoke")

        target = UserFactory()
        approval = SimpleUploadedFile("approval.eml", b"ok", content_type="message/rfc822")

        for actor in (admin, prod_manager):
            with pytest.raises(PermissionServiceError, match="Only Super Admin"):
                PermissionService.grant_permission(
                    actor=actor,
                    target_user=target,
                    permission_code="lead.delete",
                    approval_email=approval,
                    confirm=True,
                )
            with pytest.raises(RolePermissionServiceError, match="Only Super Admin"):
                RolePermissionService.grant_permission(
                    actor=actor,
                    role_slug="relationship-manager",
                    permission_code="document.delete",
                    approval_email=approval,
                    confirm=True,
                )

        # Super Admin may grant non-role-locked delete permissions (RM has no super-admin lock).
        RolePermissionService.grant_permission(
            actor=super_admin,
            role_slug="relationship-manager",
            permission_code="document.delete",
            approval_email=SimpleUploadedFile(
                "approval2.eml", b"ok", content_type="message/rfc822"
            ),
            confirm=True,
        )
        PermissionService.grant_permission(
            actor=super_admin,
            target_user=target,
            permission_code="lead.delete",
            approval_email=SimpleUploadedFile(
                "approval3.eml", b"ok", content_type="message/rfc822"
            ),
            confirm=True,
        )
        assert "lead.delete" in resolve_user_permissions(target)


@pytest.mark.django_db
class TestAuthGrantDeleteFlag:
    def test_can_grant_delete_permission_flag(self):
        from django.core.management import call_command

        from apps.accounts.services.auth_context import build_auth_context

        call_command("seed_permissions")
        admin = UserFactory()
        sa = UserFactory()
        UserRole.objects.create(user=admin, role=Role.objects.get(slug="admin"))
        UserRole.objects.create(user=sa, role=Role.objects.get(slug="super-admin"))

        admin_ctx = build_auth_context(admin)
        sa_ctx = build_auth_context(sa)
        assert admin_ctx["access"]["can_grant_permission"] is True
        assert admin_ctx["access"]["can_grant_delete_permission"] is False
        assert sa_ctx["access"]["can_grant_delete_permission"] is True
