import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory

from apps.accounts.models import Role, UserRole


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


@pytest.mark.django_db
class TestReportingPermissions:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    @pytest.fixture
    def client(self):
        return APIClient()

    def test_account_finance_can_load_reporting_endpoints(self, client):
        finance = UserFactory(email="finance-reporting@test.com")
        _assign_role(finance, "account-finance")
        client.force_authenticate(user=finance)

        for url_name in (
            "report-filters",
            "report-disbursed",
            "report-collection",
            "report-cibil",
        ):
            response = client.get(reverse(url_name))
            assert response.status_code == status.HTTP_200_OK, url_name
