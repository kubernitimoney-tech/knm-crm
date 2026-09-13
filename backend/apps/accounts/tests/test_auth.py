import pytest
from django.urls import reverse
from django.utils import timezone
from tests.factories import UserFactory


@pytest.mark.django_db
class TestAuthentication:
    def test_login_success(self, api_client):
        user = UserFactory(email="login@test.com")
        url = reverse("auth-login")
        response = api_client.post(url, {"email": "login@test.com", "password": "testpass123"})
        assert response.status_code == 200
        assert response.data["success"] is True
        assert "tokens" in response.data["data"]

    def test_login_updates_last_login(self, api_client):
        user = UserFactory(email="login-track@test.com")
        assert user.last_login is None

        url = reverse("auth-login")
        before = timezone.now()
        response = api_client.post(
            url,
            {"email": "login-track@test.com", "password": "testpass123"},
        )
        after = timezone.now()

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.last_login is not None
        assert before <= user.last_login <= after

    def test_new_login_invalidates_previous_session(self, api_client):
        user = UserFactory(email="single-session@test.com")
        url = reverse("auth-login")

        first = api_client.post(
            url,
            {"email": "single-session@test.com", "password": "testpass123"},
        )
        assert first.status_code == 200
        first_tokens = first.data["data"]["tokens"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {first_tokens['access']}")

        me = api_client.get(reverse("auth-me"))
        assert me.status_code == 200

        second = api_client.post(
            url,
            {"email": "single-session@test.com", "password": "testpass123"},
        )
        assert second.status_code == 200

        stale = api_client.get(reverse("auth-me"))
        assert stale.status_code == 401

        user.refresh_from_db()
        assert user.session_epoch == 2

    def test_login_accepts_email_case_insensitive(self, api_client):
        UserFactory(email="case@test.com")
        url = reverse("auth-login")
        response = api_client.post(
            url,
            {"email": "Case@Test.com", "password": "testpass123"},
        )
        assert response.status_code == 200

    def test_login_invalid(self, api_client):
        url = reverse("auth-login")
        response = api_client.post(url, {"email": "x@test.com", "password": "wrong"})
        assert response.status_code == 401
