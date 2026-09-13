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
class TestApplicationPipelinePermissions:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    @pytest.fixture
    def client(self):
        return APIClient()

    def test_account_finance_can_load_disbursal_pipeline_stages(self, client):
        finance = UserFactory(email="finance-pipeline@test.com")
        _assign_role(finance, "account-finance")
        client.force_authenticate(user=finance)

        for stage in ("disbursal-sheet", "disbursed", "enach"):
            response = client.get(reverse("application-pipeline"), {"stage": stage})
            assert response.status_code == status.HTTP_200_OK, stage

    def test_account_finance_cannot_load_sanction_pipeline_without_application_view(self, client):
        finance = UserFactory(email="finance-sanction-pipeline@test.com")
        _assign_role(finance, "account-finance")
        client.force_authenticate(user=finance)

        response = client.get(reverse("application-pipeline"), {"stage": "sanction-approved"})
        assert response.status_code == status.HTTP_403_FORBIDDEN
