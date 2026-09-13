from datetime import date

from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, grant_permission

from apps.accounts.models import Permission, Role, UserPermission, UserRole
from apps.organization.models import BankHoliday


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


class BankHolidayAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def setUp(self):
        self.client = APIClient()
        self.super_admin = UserFactory(email="bank-holiday-super@test.com")
        _assign_role(self.super_admin, "super-admin")
        self.client.force_authenticate(user=self.super_admin)
        self.list_url = "/api/v1/organization/bank-holidays/"

    def test_create_list_and_filter_by_financial_year(self):
        payload = {
            "holiday_date": "2026-10-02",
            "holiday_name": "Mahatma Gandhi Jayanti",
            "financial_year_start": 2026,
        }
        create_response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["data"]["holiday_name"], payload["holiday_name"])
        self.assertEqual(create_response.data["data"]["financial_year_display"], "2026-27")

        list_response = self.client.get(self.list_url, {"financial_year": 2026})
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        rows = list_response.data["data"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["holiday_name"], payload["holiday_name"])

    def test_rejects_financial_year_outside_allowed_range(self):
        payload = {
            "holiday_date": "2026-08-15",
            "holiday_name": "Independence Day",
            "financial_year_start": 2025,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_holiday_outside_selected_financial_year(self):
        payload = {
            "holiday_date": "2027-04-01",
            "holiday_name": "Annual Closing",
            "financial_year_start": 2026,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_duplicate_date_in_same_financial_year(self):
        BankHoliday.objects.create(
            holiday_date=date(2026, 8, 15),
            holiday_name="Independence Day",
            financial_year_start=2026,
            created_by=self.super_admin,
            updated_by=self.super_admin,
        )
        payload = {
            "holiday_date": "2026-08-15",
            "holiday_name": "Duplicate Holiday",
            "financial_year_start": 2026,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_and_delete_holiday(self):
        holiday = BankHoliday.objects.create(
            holiday_date=date(2026, 12, 25),
            holiday_name="Christmas",
            financial_year_start=2026,
            created_by=self.super_admin,
            updated_by=self.super_admin,
        )
        detail_url = f"{self.list_url}{holiday.id}/"

        patch_response = self.client.patch(
            detail_url,
            {"holiday_name": "Christmas Day"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["data"]["holiday_name"], "Christmas Day")

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertFalse(BankHoliday.objects.filter(pk=holiday.id).exists())

    def test_cm_with_dashboard_view_can_list_but_not_mutate(self):
        cm = UserFactory(email="cm-bank-holiday@test.com")
        _assign_role(cm, "credit-manager")
        grant_permission(cm, "dashboard.view")

        BankHoliday.objects.create(
            holiday_date=date(2026, 1, 26),
            holiday_name="Republic Day",
            financial_year_start=2026,
            created_by=self.super_admin,
            updated_by=self.super_admin,
        )

        client = APIClient()
        client.force_authenticate(user=cm)

        list_response = client.get(self.list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data["data"]), 1)

        create_response = client.post(
            self.list_url,
            {
                "holiday_date": "2026-11-01",
                "holiday_name": "Test Holiday",
                "financial_year_start": 2026,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)


class SeedPermissionsNonDestructiveTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def test_seed_without_reset_preserves_user_permission_grants(self):
        user = UserFactory(email="custom-perm-user@test.com")
        permission = Permission.objects.get(code="loan.view")
        UserPermission.objects.create(user=user, permission=permission, is_active=True)

        call_command("seed_permissions")

        self.assertTrue(
            UserPermission.objects.filter(user=user, permission=permission, is_active=True).exists()
        )

    def test_seed_with_reset_wipes_user_permission_grants(self):
        user = UserFactory(email="reset-perm-user@test.com")
        permission = Permission.objects.get(code="loan.view")
        UserPermission.objects.create(user=user, permission=permission, is_active=True)

        call_command("seed_permissions", reset=True)

        self.assertFalse(UserPermission.objects.filter(user=user).exists())
