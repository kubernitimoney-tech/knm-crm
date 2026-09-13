from django.test import TestCase
from rest_framework.test import APIRequestFactory
from tests.factories import UserFactory, grant_permission

from apps.accounts.permissions import HasRBACPermission


class UnconfiguredView:
    permission_classes = [HasRBACPermission]


class ConfiguredView:
    permission_classes = [HasRBACPermission]
    required_permission = "loan.view"


class HasRBACPermissionFailClosedTests(TestCase):
    def test_denies_when_no_permission_configured(self):
        user = UserFactory()
        request = APIRequestFactory().get("/")
        request.user = user
        permission = HasRBACPermission()
        self.assertFalse(permission.has_permission(request, UnconfiguredView()))

    def test_allows_when_permission_configured_and_granted(self):
        user = UserFactory()
        grant_permission(user, "loan.view")
        request = APIRequestFactory().get("/")
        request.user = user
        permission = HasRBACPermission()
        self.assertTrue(permission.has_permission(request, ConfiguredView()))
