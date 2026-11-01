from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.helpdesk.models import (
    Ticket,
    TicketCategory,
    TicketCloseType,
    TicketEvent,
    TicketStatus,
)
from apps.helpdesk.services.ticket_service import TicketService
from apps.notifications.models import Notification

BASE = "/api/v1/helpdesk/tickets/"


def _user_with_role(email: str, slug: str):
    user = UserFactory(email=email)
    UserRole.objects.create(user=user, role=Role.objects.get(slug=slug))
    return user


class HelpdeskTicketAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        cls.rm = _user_with_role("hd-rm@test.com", "relationship-manager")
        cls.cm = _user_with_role("hd-cm@test.com", "credit-manager")
        cls.it = _user_with_role("hd-it@test.com", "it-support")
        cls.it2 = _user_with_role("hd-it2@test.com", "it-support")
        cls.category = TicketCategory.objects.get(department="credit", name="Repayment date change")

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def _raise(self, user=None, **extra):
        payload = {
            "category": str(self.category.id),
            "subject": "Cannot change repayment date",
            "description": "Date picker is locked for KNM00000012.",
            "reference_text": "KNM00000012",
            **extra,
        }
        response = self._client(user or self.cm).post(BASE, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data["data"]

    def _post(self, user, ticket_id, action, payload=None):
        return self._client(user).post(f"{BASE}{ticket_id}/{action}/", payload or {}, format="json")

    def _resolved_ticket(self):
        data = self._raise()
        self._post(self.it, data["id"], "start")
        response = self._post(self.it, data["id"], "resolve", {"remark": "Date updated."})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data["data"]

    # ------------------------------------------------------------------ raising

    def test_raise_ticket_numbers_it_and_notifies_it_support(self):
        data = self._raise()
        self.assertRegex(data["ticket_no"], r"^HD-\d{4}-000001$")
        self.assertEqual(data["status"], TicketStatus.OPEN)
        self.assertEqual(data["department"], "credit")
        self.assertEqual(data["priority"], self.category.default_priority)
        self.assertEqual(data["allowed_actions"], ["cancel", "comment"])
        self.assertEqual(data["events"][0]["kind"], TicketEvent.Kind.CREATED)
        for agent in (self.it, self.it2):
            self.assertTrue(
                Notification.objects.filter(
                    recipient=agent, metadata__ticket_id=data["id"]
                ).exists()
            )
        self.assertEqual(self._raise()["ticket_no"][-6:], "000002")

    def test_raise_with_linked_record(self):
        customer = customer_factory()
        data = self._raise(linked_type="customer", linked_id=str(customer.id))
        self.assertEqual(data["linked_type"], "customer")
        self.assertEqual(data["linked_object_id"], str(customer.id))
        self.assertTrue(data["linked_label"])

    def test_raise_with_missing_linked_record_is_rejected(self):
        response = self._client(self.rm).post(
            BASE,
            {
                "category": str(self.category.id),
                "subject": "x",
                "description": "y",
                "linked_type": "loan",
                "linked_id": "00000000-0000-0000-0000-000000000001",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_raiser_sees_only_own_tickets_and_it_sees_all(self):
        cm_ticket = self._raise(self.cm)
        rm_ticket = self._raise(self.rm)

        rm_list = self._client(self.rm).get(BASE).data["data"]["results"]
        self.assertEqual([t["id"] for t in rm_list], [rm_ticket["id"]])
        self.assertEqual(
            self._client(self.rm).get(f"{BASE}{cm_ticket['id']}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        it_list = self._client(self.it).get(BASE).data["data"]["results"]
        self.assertEqual(len(it_list), 2)

    # ---------------------------------------------------------------- resolving

    def test_raiser_cannot_work_or_resolve(self):
        data = self._raise()
        for action in ("start", "resolve", "assign"):
            response = self._post(self.cm, data["id"], action, {"remark": "done"})
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, action)

    def test_resolve_requires_remark_and_sets_auto_close(self):
        data = self._raise()
        response = self._post(self.it, data["id"], "resolve", {"remark": "  "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._post(
            self.it,
            data["id"],
            "resolve",
            {
                "remark": "Repayment date moved to 05-12-2026.",
                "corrections": [
                    {"field": "repayment_date", "before": "01-12-2026", "after": "05-12-2026"}
                ],
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        body = response.data["data"]
        self.assertEqual(body["status"], TicketStatus.RESOLVED)
        self.assertEqual(body["assigned_to"]["id"], str(self.it.id))
        self.assertIsNotNone(body["auto_close_at"])
        resolved_event = body["events"][-1]
        self.assertEqual(resolved_event["metadata"]["corrections"][0]["field"], "repayment_date")
        self.assertTrue(
            Notification.objects.filter(recipient=self.cm, metadata__ticket_id=data["id"]).exists()
        )

    def test_it_cannot_resolve_a_ticket_they_raised(self):
        data = self._raise(self.it)
        response = self._post(self.it, data["id"], "resolve", {"remark": "fixed"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self._post(self.it2, data["id"], "resolve", {"remark": "fixed"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hold_requires_reason_and_in_progress(self):
        data = self._raise()
        self.assertEqual(
            self._post(self.it, data["id"], "hold", {"remark": "Need loan no."}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self._post(self.it, data["id"], "start")
        self.assertEqual(
            self._post(self.it, data["id"], "hold").status_code, status.HTTP_400_BAD_REQUEST
        )
        response = self._post(self.it, data["id"], "hold", {"remark": "Need loan no."})
        self.assertEqual(response.data["data"]["status"], TicketStatus.ON_HOLD)

    def test_assign_only_to_it_support(self):
        data = self._raise()
        response = self._post(self.it, data["id"], "assign", {"assignee": str(self.rm.id)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self._post(self.it, data["id"], "assign", {"assignee": str(self.it2.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["assigned_to"]["id"], str(self.it2.id))

    # ------------------------------------------------------ closing / reopening

    def test_only_raiser_can_close(self):
        data = self._resolved_ticket()
        self.assertEqual(data["allowed_actions"], ["comment"])  # IT view
        response = self._post(self.it, data["id"], "close")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        raiser_view = self._client(self.cm).get(f"{BASE}{data['id']}/").data["data"]
        self.assertEqual(raiser_view["allowed_actions"], ["close", "reopen", "comment"])
        response = self._post(self.cm, data["id"], "close", {"remark": "Verified."})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.data["data"]
        self.assertEqual(body["status"], TicketStatus.CLOSED)
        self.assertEqual(body["close_type"], TicketCloseType.CONFIRMED)
        self.assertIsNone(body["auto_close_at"])

    def test_close_requires_resolved_status(self):
        data = self._raise()
        response = self._post(self.cm, data["id"], "close")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reopen_then_resolve_again(self):
        data = self._resolved_ticket()
        self.assertEqual(
            self._post(self.cm, data["id"], "reopen").status_code, status.HTTP_400_BAD_REQUEST
        )
        response = self._post(self.cm, data["id"], "reopen", {"remark": "Still the old date."})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.data["data"]
        self.assertEqual(body["status"], TicketStatus.REOPENED)
        self.assertEqual(body["reopen_count"], 1)
        self.assertIsNone(body["auto_close_at"])

        response = self._post(self.it, data["id"], "resolve", {"remark": "Cache cleared too."})
        self.assertEqual(response.data["data"]["status"], TicketStatus.RESOLVED)

    def test_closed_ticket_cannot_be_reopened_or_commented(self):
        data = self._resolved_ticket()
        self._post(self.cm, data["id"], "close")
        response = self._post(self.cm, data["id"], "reopen", {"remark": "again"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self._post(self.cm, data["id"], "comments", {"body": "hello"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_follow_up_ticket_links_closed_one(self):
        data = self._resolved_ticket()
        self._post(self.cm, data["id"], "close")
        follow_up = self._raise(related_ticket=data["id"])
        self.assertEqual(follow_up["related_ticket"]["ticket_no"], data["ticket_no"])

    def test_cancel_only_open_by_raiser(self):
        data = self._raise()
        self.assertEqual(
            self._post(self.rm, data["id"], "cancel").status_code, status.HTTP_404_NOT_FOUND
        )
        response = self._post(self.cm, data["id"], "cancel", {"remark": "Sorted myself"})
        self.assertEqual(response.data["data"]["status"], TicketStatus.CANCELLED)

    def test_auto_close_after_three_working_days(self):
        data = self._resolved_ticket()
        ticket = Ticket.objects.get(pk=data["id"])
        self.assertEqual(TicketService.auto_close_due(now=ticket.auto_close_at - timedelta(1)), 0)
        self.assertEqual(
            TicketService.auto_close_due(now=ticket.auto_close_at + timedelta(seconds=1)), 1
        )
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, TicketStatus.CLOSED)
        self.assertEqual(ticket.close_type, TicketCloseType.AUTO)
        self.assertIsNone(ticket.closed_by)
        self.assertTrue(ticket.events.filter(kind=TicketEvent.Kind.AUTO_CLOSED).exists())

    # ------------------------------------------------- comments / files / export

    def test_internal_notes_hidden_from_raiser(self):
        data = self._raise()
        response = self._post(self.cm, data["id"], "comments", {"body": "x", "is_internal": True})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self._post(self.it, data["id"], "comments", {"body": "Check DB", "is_internal": True})
        self._post(self.it, data["id"], "comments", {"body": "Please share the loan no."})

        raiser_comments = self._client(self.cm).get(f"{BASE}{data['id']}/").data["data"]
        self.assertEqual(
            [c["body"] for c in raiser_comments["comments"]], ["Please share the loan no."]
        )
        it_comments = self._client(self.it).get(f"{BASE}{data['id']}/").data["data"]
        self.assertEqual(len(it_comments["comments"]), 2)

    def test_attachment_upload_checks_content(self):
        data = self._raise()
        url = f"{BASE}{data['id']}/attachments/"
        png = SimpleUploadedFile("shot.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png")
        response = self._client(self.cm).post(url, {"file": png}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["data"]["file_name"], "shot.png")

        fake = SimpleUploadedFile("shot.png", b"<html><script>x</script>", "image/png")
        response = self._client(self.cm).post(url, {"file": fake}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_is_it_only_and_escapes_formulas(self):
        self._raise(subject="=HYPERLINK(evil)")
        self.assertEqual(
            self._client(self.cm).get(f"{BASE}export/").status_code, status.HTTP_403_FORBIDDEN
        )
        response = self._client(self.it).get(f"{BASE}export/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("'=HYPERLINK(evil)", response.content.decode())

    def test_summary_counts(self):
        self._resolved_ticket()
        self._raise()
        cm_summary = self._client(self.cm).get(f"{BASE}summary/").data["data"]
        self.assertEqual(cm_summary["by_status"]["open"], 1)
        self.assertEqual(cm_summary["awaiting_my_confirmation"], 1)
        it_summary = self._client(self.it).get(f"{BASE}summary/").data["data"]
        self.assertEqual(it_summary["unassigned"], 1)
        self.assertEqual(it_summary["assigned_to_me_open"], 0)

    def test_categories_listed_for_raisers_but_managed_by_admin(self):
        response = self._client(self.rm).get("/api/v1/helpdesk/categories/?department=accounts")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {c["name"] for c in response.data["data"]}
        self.assertIn("UTR number update", names)
        response = self._client(self.it).post(
            "/api/v1/helpdesk/categories/", {"department": "general", "name": "New"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
