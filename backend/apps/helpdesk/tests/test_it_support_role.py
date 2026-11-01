from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.accounts.services.role_helpers import get_assignable_role_slugs
from apps.activities.models import Activity
from apps.leads.models import CallDisposition, Lead, LeadSource, LeadStatus
from apps.leads.services.call_log_service import CallLogService


def _user_with_role(email: str, slug: str):
    user = UserFactory(email=email)
    UserRole.objects.create(user=user, role=Role.objects.get(slug=slug))
    return user


class ITSupportRoleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        cls.it = _user_with_role("scope-it@test.com", "it-support")
        cls.rm = _user_with_role("scope-rm@test.com", "relationship-manager")
        cls.admin = _user_with_role("scope-admin@test.com", "admin")
        cls.super_admin = _user_with_role("scope-super@test.com", "super-admin")
        source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
        # Not assigned to IT: visibility must come from the role itself.
        cls.lead = Lead.objects.create(
            lead_id="IT-SCOPE-1",
            customer=customer_factory(),
            source=source,
            status=LeadStatus.FRESH,
            assigned_rm=cls.rm,
        )

    def test_it_support_can_correct_but_not_move_money_or_manage_access(self):
        perms = resolve_user_permissions(self.it)
        for code in (
            "lead.view",
            "loan.view",
            "disbursal.view",
            "collection.view",
            "audit.view",
            "ticket.resolve",
            "call_log.update",
            "lead.update",
            "customer.update",
            "collection.export",
        ):
            self.assertIn(code, perms, code)
        for code in (
            "application.approve",
            "application.reject",
            "application.sanction",
            "disbursal.send",
            "disbursal.create",
            "disbursal.update",
            "collection.update",
            "loan.update",
            "lead.delete",
            "user.view",
            "user.create",
            "role.update",
            "permission.grant",
        ):
            self.assertNotIn(code, perms, code)

    def test_only_super_admin_assigns_it_support(self):
        self.assertNotIn("it-support", get_assignable_role_slugs(self.admin))
        self.assertIn("it-support", get_assignable_role_slugs(self.super_admin))

    def test_rm_cannot_edit_saved_call_log(self):
        log = CallLogService.log(user=self.rm, lead=self.lead, disposition=CallDisposition.BUSY)
        client = APIClient()
        client.force_authenticate(user=self.rm)
        response = client.patch(
            f"/api/v1/leads/{self.lead.id}/call-logs/{log.id}/", {"remarks": "x"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_it_corrects_call_log_on_unassigned_lead_without_side_effects(self):
        log = CallLogService.log(
            user=self.rm, lead=self.lead, disposition=CallDisposition.BUSY, remarks="wrong"
        )
        self.lead.refresh_from_db()
        status_before = self.lead.status

        client = APIClient()
        client.force_authenticate(user=self.it)
        response = client.patch(
            f"/api/v1/leads/{self.lead.id}/call-logs/{log.id}/",
            {"disposition": CallDisposition.NO_ANSWER, "remarks": "Customer did not pick up"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        log.refresh_from_db()
        self.assertEqual(log.disposition, CallDisposition.NO_ANSWER)
        self.assertEqual(log.remarks, "Customer did not pick up")
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, status_before)

        audit = Activity.objects.get(verb="call_log_corrected", object_id=self.lead.id)
        self.assertEqual(audit.metadata["before"]["remarks"], "wrong")
        self.assertEqual(audit.metadata["after"]["disposition"], CallDisposition.NO_ANSWER)

    def test_call_log_not_found(self):
        client = APIClient()
        client.force_authenticate(user=self.it)
        for bad_id in ("not-a-uuid", "00000000-0000-0000-0000-000000000001"):
            response = client.patch(
                f"/api/v1/leads/{self.lead.id}/call-logs/{bad_id}/", {"remarks": "x"}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, bad_id)
