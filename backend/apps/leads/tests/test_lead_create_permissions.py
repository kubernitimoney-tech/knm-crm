import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import Role, UserRole


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.update_or_create(user=user, defaults={"role": role})


@pytest.mark.django_db
class TestLeadCreatePermissions:
    @pytest.fixture(autouse=True)
    def seed_rbac(self):
        call_command("seed_permissions")

    def test_senior_credit_manager_with_lead_create_can_lookup_customer(self):
        user = UserFactory()
        _assign_role(user, "senior-credit-manager")
        grant_permission(user, "lead.create")

        client = APIClient()
        client.force_authenticate(user=user)
        url = reverse("lead-customer-lookup")
        response = client.get(url, {"mobile_number": "9876543210"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert response.data["data"]["exists"] is False

    def test_senior_credit_manager_with_lead_create_can_create_lead(self):
        user = UserFactory()
        _assign_role(user, "senior-credit-manager")
        grant_permission(user, "lead.create")

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            reverse("lead-list"),
            {
                "first_name": "Priya",
                "last_name": "Sharma",
                "email": "priya.scm@test.com",
                "mobile_number": "9123456780",
                "dob": "1992-05-15",
                "gender": "female",
                "pan_no": "ABCDE1234F",
                "required_amount": "50000",
                "loan_purpose": "Personal",
                "employment": {
                    "employment_type": "salaried",
                    "monthly_salary": "60000",
                },
                "address": {
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True

    def test_senior_credit_manager_without_lead_create_is_denied(self):
        user = UserFactory()
        _assign_role(user, "senior-credit-manager")

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            reverse("lead-list"),
            {
                "first_name": "Denied",
                "last_name": "User",
                "email": "denied.scm@test.com",
                "mobile_number": "9123456781",
                "dob": "1992-05-15",
                "gender": "female",
                "pan_no": "ABCDE1234G",
                "required_amount": "50000",
                "loan_purpose": "Personal",
                "employment": {
                    "employment_type": "salaried",
                    "monthly_salary": "60000",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
