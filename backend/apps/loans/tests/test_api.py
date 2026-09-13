import pytest
from django.core.management import call_command
from tests.factories import grant_permission


@pytest.mark.django_db
class TestLoanAPI:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")
        call_command("seed_loan_workflow")

    def test_dashboard_requires_auth(self, api_client):
        response = api_client.get("/api/v1/dashboard/")
        assert response.status_code == 401

    def test_dashboard_with_permission(self, authenticated_client, user):
        grant_permission(user, "dashboard.view")
        response = authenticated_client.get("/api/v1/dashboard/")
        assert response.status_code == 200
        assert response.data["success"] is True
