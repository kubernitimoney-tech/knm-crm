import pytest
from django.urls import reverse
from rest_framework import status
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import Role, UserRole
from apps.accounts.services.token_service import TokenService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _auth_client(api_client, user):
    tokens = TokenService.issue_tokens(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client


from unittest.mock import Mock, patch

from apps.accounts.services.user_service import UserService, UserServiceError


class TestUserServiceResetPassword:
    def test_requires_super_admin(self):
        actor = Mock(is_authenticated=True, id=1)
        target = Mock(id=2, is_active=True)

        with patch("apps.accounts.services.user_service.is_super_admin", return_value=False):
            with pytest.raises(UserServiceError, match="Only Super Admin"):
                UserService.reset_password(actor=actor, target_user=target, confirm=True)

    def test_requires_confirmation(self):
        actor = Mock(is_authenticated=True, id=1)
        target = Mock(id=2, is_active=True)

        with patch("apps.accounts.services.user_service.is_super_admin", return_value=True):
            with pytest.raises(UserServiceError) as exc:
                UserService.reset_password(actor=actor, target_user=target, confirm=False)
            assert exc.value.requires_confirmation

    def test_cannot_reset_own_password(self):
        actor = Mock(is_authenticated=True, id=1)
        target = Mock(id=1, is_active=True)

        with patch("apps.accounts.services.user_service.is_super_admin", return_value=True):
            with pytest.raises(UserServiceError, match="cannot reset your own password"):
                UserService.reset_password(actor=actor, target_user=target, confirm=True)

    def test_inactive_account_rejected(self):
        actor = Mock(is_authenticated=True, id=1)
        target = Mock(id=2, is_active=False)

        with patch("apps.accounts.services.user_service.is_super_admin", return_value=True):
            with pytest.raises(UserServiceError, match="inactive account"):
                UserService.reset_password(actor=actor, target_user=target, confirm=True)


@pytest.mark.django_db
class TestUserPasswordResetApi:
    def test_super_admin_can_reset_employee_password(self, api_client):
        from django.core.management import call_command

        call_command("seed_permissions")

        super_admin = UserFactory(email="super@test.com")
        super_admin.is_superuser = True
        super_admin.save(update_fields=["is_superuser"])

        employee = UserFactory(email="employee@test.com")
        old_password_hash = employee.password

        url = reverse("user-reset-password", kwargs={"pk": employee.pk})
        _auth_client(api_client, super_admin)
        response = api_client.post(url, {"confirm": True}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "temporary_password" in response.data["data"]

        employee.refresh_from_db()
        assert employee.password != old_password_hash
        assert employee.check_password(response.data["data"]["temporary_password"])

    def test_non_super_admin_cannot_reset_password(self, api_client):
        from django.core.management import call_command

        call_command("seed_permissions")

        admin = UserFactory(email="admin@test.com")
        _assign_role(admin, "admin")
        grant_permission(admin, "user.view")

        employee = UserFactory(email="employee2@test.com")
        url = reverse("user-reset-password", kwargs={"pk": employee.pk})
        _auth_client(api_client, admin)
        response = api_client.post(url, {"confirm": True}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reset_requires_confirmation(self, api_client):
        super_admin = UserFactory(email="super2@test.com")
        super_admin.is_superuser = True
        super_admin.save(update_fields=["is_superuser"])

        employee = UserFactory(email="employee3@test.com")
        url = reverse("user-reset-password", kwargs={"pk": employee.pk})
        _auth_client(api_client, super_admin)
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["requires_confirmation"] is True

    def test_super_admin_cannot_reset_own_password(self, api_client):
        super_admin = UserFactory(email="super3@test.com")
        super_admin.is_superuser = True
        super_admin.save(update_fields=["is_superuser"])

        url = reverse("user-reset-password", kwargs={"pk": super_admin.pk})
        _auth_client(api_client, super_admin)
        response = api_client.post(url, {"confirm": True}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot reset your own password" in response.data["message"].lower()
