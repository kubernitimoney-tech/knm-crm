import pytest
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, grant_permission

from apps.dashboard.models import BranchSanctionTarget
from apps.organization.models import Branch

URL = "/api/v1/dashboard/branch-targets/"


@pytest.fixture
def branch(db):
    return Branch.objects.create(
        branch_code="DEL01",
        branch_name="Delhi",
        bank_name="Kuberniti",
        address_line1="1 Main Road",
        city="Delhi",
        state="Delhi",
        mobile_no="9876500000",
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _payload(branch):
    return {
        "branch": str(branch.id),
        "target_amount": "500000.00",
        "period_year": 2026,
        "period_month": 11,
    }


@pytest.mark.django_db
def test_create_needs_branch_target_create(branch):
    user = UserFactory(email="target-viewer@test.com")
    grant_permission(user, "dashboard.view")

    response = _client(user).post(URL, _payload(branch), format="json")
    assert response.status_code == status.HTTP_403_FORBIDDEN

    grant_permission(user, "branch_target.create")
    response = _client(user).post(URL, _payload(branch), format="json")
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_update_and_delete_use_their_own_permissions(branch):
    target = BranchSanctionTarget.objects.create(
        branch=branch, target_amount=100000, period_year=2026, period_month=10
    )
    user = UserFactory(email="target-editor@test.com")
    grant_permission(user, "branch_target.update")
    client = _client(user)

    response = client.patch(f"{URL}{target.id}/", {"target_amount": "200000.00"}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert client.delete(f"{URL}{target.id}/").status_code == status.HTTP_403_FORBIDDEN

    grant_permission(user, "branch_target.delete")
    assert client.delete(f"{URL}{target.id}/").status_code == status.HTTP_200_OK
