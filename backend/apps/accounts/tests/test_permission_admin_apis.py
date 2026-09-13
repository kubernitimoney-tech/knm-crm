"""API coverage for the five-pillar permission admin surface."""

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient
from tests.factories import UserFactory

from apps.accounts.models import Role, UserRole


@pytest.mark.django_db
class TestPermissionAdminApis:
    def setup_method(self):
        call_command("seed_permissions")
        self.client = APIClient()
        self.sa = UserFactory(is_superuser=True)
        self.sa_role = Role.objects.get(slug="super-admin")
        UserRole.objects.get_or_create(user=self.sa, role=self.sa_role)
        self.client.force_authenticate(user=self.sa)

    def test_permission_catalog(self):
        res = self.client.get("/api/v1/accounts/permissions/catalog/")
        assert res.status_code == 200
        assert res.data["success"] is True
        data = res.data["data"]
        assert data["total_permissions"] > 0
        assert data["modules"]
        first_module = data["modules"][0]
        perms = first_module["permissions"]
        assert any(m["permissions"] for m in data["modules"])
        assert "status" in perms[0]
        assert "description" not in perms[0]
        codes = [p["code"] for m in data["modules"] for p in m["permissions"]]
        assert codes == sorted(codes)

    def test_create_permission(self):
        res = self.client.post(
            "/api/v1/accounts/permissions/catalog/",
            {"module": "audit", "action": "export", "status": "active"},
            format="json",
        )
        assert res.status_code == 201
        assert res.data["success"] is True
        assert res.data["data"]["code"] == "audit.export"
        assert res.data["data"]["status"] == "active"
        perm_id = res.data["data"]["id"]

        dup = self.client.post(
            "/api/v1/accounts/permissions/catalog/",
            {"module": "audit", "action": "export"},
            format="json",
        )
        assert dup.status_code == 400

        patched = self.client.patch(
            f"/api/v1/accounts/permissions/catalog/{perm_id}/",
            {"status": "inactive"},
            format="json",
        )
        assert patched.status_code == 200
        assert patched.data["data"]["status"] == "inactive"

        reactivated = self.client.patch(
            f"/api/v1/accounts/permissions/catalog/{perm_id}/",
            {"status": "active"},
            format="json",
        )
        assert reactivated.status_code == 200

        deleted = self.client.delete(f"/api/v1/accounts/permissions/catalog/{perm_id}/")
        assert deleted.status_code == 200
        assert deleted.data["data"]["status"] == "inactive"

        again = self.client.delete(f"/api/v1/accounts/permissions/catalog/{perm_id}/")
        assert again.status_code == 400

    def test_role_directory(self):
        res = self.client.get("/api/v1/accounts/roles/directory/")
        assert res.status_code == 200
        roles = res.data["data"]["roles"]
        assert any(r["slug"] == "admin" for r in roles)
        admin = next(r for r in roles if r["slug"] == "admin")
        assert "permission_count" in admin
        assert "user_count" in admin

    def test_create_role(self):
        res = self.client.post(
            "/api/v1/accounts/roles/",
            {
                "name": "Quality Analyst",
                "display_name": "QA",
                "description": "Reviews underwriting quality.",
                "status": "active",
            },
            format="json",
        )
        assert res.status_code == 201
        body = res.data["data"] if "success" in res.data else res.data
        assert body["slug"] == "quality-analyst"
        assert body["name"] == "Quality Analyst"
        assert Role.objects.filter(slug="quality-analyst").exists()

        directory = self.client.get("/api/v1/accounts/roles/directory/")
        slugs = [r["slug"] for r in directory.data["data"]["roles"]]
        assert "quality-analyst" in slugs

        dup = self.client.post(
            "/api/v1/accounts/roles/",
            {"name": "Quality Analyst 2", "slug": "quality-analyst"},
            format="json",
        )
        assert dup.status_code == 400

    def test_role_assignees_and_user_inventory(self):
        target = UserFactory()
        UserRole.objects.create(user=target, role=Role.objects.get(slug="relationship-manager"))

        res = self.client.get("/api/v1/accounts/roles/relationship-manager/assignees/")
        assert res.status_code == 200
        users = res.data["data"]["users"]
        assert any(u["user_id"] == str(target.id) for u in users)

        inv = self.client.get(f"/api/v1/accounts/users/{target.id}/permissions/")
        assert inv.status_code == 200
        body = inv.data["data"]
        assert body["user"]["id"] == str(target.id)
        assert body["roles"]
        assert body["effective_count"] >= body["role_permission_count"]
