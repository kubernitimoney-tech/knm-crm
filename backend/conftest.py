import pytest
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from tests.factories import UserFactory


def _test_uses_database(request) -> bool:
    if "db" in request.fixturenames or "transactional_db" in request.fixturenames:
        return True
    if request.node.get_closest_marker("django_db"):
        return True
    cls = getattr(request.node, "cls", None)
    if cls is not None and issubclass(cls, TestCase) and not issubclass(cls, SimpleTestCase):
        return True
    return False


@pytest.fixture(autouse=True)
def seed_test_master_data(request, django_db_blocker):
    """Seed PAYDAY product and RBAC for DB-backed tests only."""
    if not _test_uses_database(request):
        return
    with django_db_blocker.unblock():
        call_command("seed_permissions")
        call_command("seed_products")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def authenticated_client(api_client, user):
    from apps.accounts.services.token_service import TokenService

    tokens = TokenService.issue_tokens(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client
