from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, application_factory, customer_factory, loan_product_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.leads.models import (
    CallDisposition,
    Lead,
    LeadCategory,
    LeadCloserType,
    LeadSource,
    LeadStatus,
)
from apps.leads.services.call_log_service import CallLogService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, category=LeadCategory.FRESH, customer=None) -> Lead:
    customer = customer or customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        status=LeadStatus.FRESH if category == LeadCategory.FRESH else LeadStatus.RELOAN,
        category=category,
    )


class TestLeadCategoryTabFilter(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")

    def setUp(self):
        self.client = APIClient()
        self.admin = UserFactory(email="admin-lead-category-tab@test.com")
        _assign_role(self.admin, "admin")
        self.client.force_authenticate(user=self.admin)

    def test_fresh_tab_excludes_lead_with_approved_application(self):
        lead = _create_lead(lead_code="LCT-FRESH-001", category=LeadCategory.FRESH)
        product = loan_product_factory()
        application = application_factory(customer=lead.customer, product=product)
        application.lead = lead
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status", "updated_at"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        open_lead = _create_lead(lead_code="LCT-FRESH-002", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(lead.lead_id, lead_ids)

    def test_reloan_tab_excludes_lead_with_approved_application(self):
        lead = _create_lead(lead_code="LCT-RELOAN-001", category=LeadCategory.RELOAN)
        product = loan_product_factory()
        application = application_factory(customer=lead.customer, product=product)
        application.lead = lead
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status", "updated_at"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        open_lead = _create_lead(lead_code="LCT-RELOAN-002", category=LeadCategory.RELOAN)

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.RELOAN})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(lead.lead_id, lead_ids)

    def test_fresh_tab_keeps_lead_with_interested_application(self):
        lead = _create_lead(lead_code="LCT-FRESH-003", category=LeadCategory.FRESH)
        product = loan_product_factory()
        application = application_factory(customer=lead.customer, product=product)
        application.lead = lead
        application.status = ApplicationStatus.INTERESTED
        application.save(update_fields=["lead", "status", "updated_at"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(lead.lead_id, lead_ids)

    def test_fresh_tab_excludes_closed_lead_with_dnd(self):
        closed_lead = _create_lead(lead_code="LCT-CLOSED-DND", category=LeadCategory.FRESH)
        closed_lead.status = LeadStatus.CLOSED
        closed_lead.close_reason = LeadCloserType.DND
        closed_lead.save(update_fields=["status", "close_reason", "updated_at"])

        open_lead = _create_lead(lead_code="LCT-CLOSED-OPEN", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(closed_lead.lead_id, lead_ids)

    def test_reloan_tab_excludes_invalid_number_status(self):
        invalid_lead = _create_lead(lead_code="LCT-CLOSED-INV", category=LeadCategory.RELOAN)
        invalid_lead.status = LeadStatus.INVALID_NUMBER
        invalid_lead.save(update_fields=["status", "updated_at"])

        open_lead = _create_lead(lead_code="LCT-RL-OPEN", category=LeadCategory.RELOAN)

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.RELOAN})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(invalid_lead.lead_id, lead_ids)

    def test_fresh_tab_excludes_not_interested_status(self):
        rejected_lead = _create_lead(lead_code="LCT-NI-001", category=LeadCategory.FRESH)
        rejected_lead.status = LeadStatus.NOT_INTERESTED
        rejected_lead.close_reason = LeadCloserType.NOT_INTERESTED
        rejected_lead.save(update_fields=["status", "close_reason", "updated_at"])

        open_lead = _create_lead(lead_code="LCT-NI-002", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"category": LeadCategory.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(rejected_lead.lead_id, lead_ids)

    def test_fresh_status_tab_excludes_lead_with_approved_application(self):
        lead = _create_lead(lead_code="LST-FRESH-001", category=LeadCategory.FRESH)
        product = loan_product_factory()
        application = application_factory(customer=lead.customer, product=product)
        application.lead = lead
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status", "updated_at"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        open_lead = _create_lead(lead_code="LST-FRESH-002", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(lead.lead_id, lead_ids)

    def test_fresh_status_tab_excludes_interested_lead_still_marked_fresh_category(self):
        interested_lead = _create_lead(lead_code="LST-FRESH-INT", category=LeadCategory.FRESH)
        interested_lead.status = LeadStatus.INTERESTED
        interested_lead.save(update_fields=["status", "updated_at"])

        open_lead = _create_lead(lead_code="LST-FRESH-OPEN", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(interested_lead.lead_id, lead_ids)

        category_response = self.client.get(
            reverse("lead-list"),
            {"category": LeadCategory.FRESH},
        )
        category_ids = {row["lead_id"] for row in category_response.data["data"]["results"]}
        self.assertIn(interested_lead.lead_id, category_ids)

    def test_fresh_status_tab_includes_leads_without_call_logs(self):
        open_lead = _create_lead(lead_code="LST-FRESH-NOCALL", category=LeadCategory.FRESH)

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)

    def test_fresh_status_tab_excludes_call_back_status(self):
        callback_lead = _create_lead(lead_code="LST-CB-FRESH", category=LeadCategory.FRESH)
        open_lead = _create_lead(lead_code="LST-CB-OPEN", category=LeadCategory.FRESH)
        CallLogService.log(
            user=self.admin,
            lead=callback_lead,
            disposition=CallDisposition.CALL_BACK,
        )

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.FRESH})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(callback_lead.lead_id, lead_ids)

    def test_reloan_status_tab_excludes_invalid_number_status(self):
        invalid_lead = _create_lead(lead_code="LST-CLOSED-INV", category=LeadCategory.RELOAN)
        invalid_lead.status = LeadStatus.INVALID_NUMBER
        invalid_lead.save(update_fields=["status", "updated_at"])

        open_lead = _create_lead(lead_code="LST-RL-OPEN", category=LeadCategory.RELOAN)

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.RELOAN})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(open_lead.lead_id, lead_ids)
        self.assertNotIn(invalid_lead.lead_id, lead_ids)

    def test_call_back_tab_filters_by_status(self):
        callback_lead = _create_lead(lead_code="LST-CB-001", category=LeadCategory.FRESH)
        other_lead = _create_lead(lead_code="LST-CB-002", category=LeadCategory.FRESH)
        CallLogService.log(
            user=self.admin,
            lead=callback_lead,
            disposition=CallDisposition.CALL_BACK,
        )
        CallLogService.log(
            user=self.admin,
            lead=other_lead,
            disposition=CallDisposition.BUSY,
        )

        response = self.client.get(
            reverse("lead-list"),
            {"status": LeadStatus.CALL_BACK},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(callback_lead.lead_id, lead_ids)
        self.assertNotIn(other_lead.lead_id, lead_ids)

    def test_no_answer_tab_filters_by_latest_call_disposition(self):
        no_answer_lead = _create_lead(lead_code="LST-NA-001", category=LeadCategory.FRESH)
        other_lead = _create_lead(lead_code="LST-NA-002", category=LeadCategory.FRESH)
        CallLogService.log(
            user=self.admin,
            lead=no_answer_lead,
            disposition=CallDisposition.NO_ANSWER,
        )
        CallLogService.log(
            user=self.admin,
            lead=other_lead,
            disposition=CallDisposition.CALL_BACK,
        )

        response = self.client.get(
            reverse("lead-list"),
            {"call_disposition": CallDisposition.NO_ANSWER},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(no_answer_lead.lead_id, lead_ids)
        self.assertNotIn(other_lead.lead_id, lead_ids)

    def test_document_pending_status_tab_filters_by_lead_status(self):
        pending_lead = _create_lead(lead_code="LST-DP-001", category=LeadCategory.FRESH)
        pending_lead.status = LeadStatus.DOCUMENTS_PENDING
        pending_lead.save(update_fields=["status", "updated_at"])

        other_lead = _create_lead(lead_code="LST-DP-002", category=LeadCategory.FRESH)

        response = self.client.get(
            reverse("lead-list"),
            {"status": LeadStatus.DOCUMENTS_PENDING},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(pending_lead.lead_id, lead_ids)
        self.assertNotIn(other_lead.lead_id, lead_ids)

    def test_document_pending_tab_filters_by_application_status(self):
        lead = _create_lead(lead_code="LST-DP-001", category=LeadCategory.FRESH)
        product = loan_product_factory()
        application = application_factory(customer=lead.customer, product=product)
        application.lead = lead
        application.status = ApplicationStatus.DOCUMENTS_INCOMPLETE
        application.save(update_fields=["lead", "status", "updated_at"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application", "updated_at"])

        other_lead = _create_lead(lead_code="LST-DP-002", category=LeadCategory.FRESH)

        response = self.client.get(
            reverse("lead-list"),
            {"application_status": "documents_pending"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(lead.lead_id, lead_ids)
        self.assertNotIn(other_lead.lead_id, lead_ids)

    def test_rejected_tab_filters_by_rejected_application_not_not_interested_alone(self):
        not_interested_only = _create_lead(lead_code="LST-REJ-NI", category=LeadCategory.FRESH)
        not_interested_only.status = LeadStatus.NOT_INTERESTED
        not_interested_only.close_reason = LeadCloserType.NOT_INTERESTED
        not_interested_only.save(update_fields=["status", "close_reason", "updated_at"])

        rejected_app_lead = _create_lead(lead_code="LST-REJ-APP", category=LeadCategory.FRESH)
        rejected_app_lead.status = LeadStatus.NOT_INTERESTED
        rejected_app_lead.close_reason = LeadCloserType.NOT_INTERESTED
        rejected_app_lead.save(update_fields=["status", "close_reason", "updated_at"])
        product = loan_product_factory()
        application = application_factory(customer=rejected_app_lead.customer, product=product)
        application.lead = rejected_app_lead
        application.status = ApplicationStatus.REJECTED
        application.save(update_fields=["lead", "status", "updated_at"])
        rejected_app_lead.converted_application = application
        rejected_app_lead.save(update_fields=["converted_application", "updated_at"])

        open_lead = _create_lead(lead_code="LST-REJ-OPEN", category=LeadCategory.FRESH)

        response = self.client.get(
            reverse("lead-list"),
            {"application_status": ApplicationStatus.REJECTED},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(rejected_app_lead.lead_id, lead_ids)
        self.assertNotIn(not_interested_only.lead_id, lead_ids)
        self.assertNotIn(open_lead.lead_id, lead_ids)

    def test_interested_status_filter_excludes_advanced_applications(self):
        pure = _create_lead(lead_code="LST-INT-PURE", category=LeadCategory.FRESH)
        pure.status = LeadStatus.INTERESTED
        pure.save(update_fields=["status", "updated_at"])

        advanced = _create_lead(lead_code="LST-INT-ADV", category=LeadCategory.FRESH)
        advanced.status = LeadStatus.INTERESTED
        advanced.save(update_fields=["status", "updated_at"])
        product = loan_product_factory()
        application = application_factory(customer=advanced.customer, product=product)
        application.lead = advanced
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status", "updated_at"])
        advanced.converted_application = application
        advanced.save(update_fields=["converted_application", "updated_at"])

        response = self.client.get(reverse("lead-list"), {"status": LeadStatus.INTERESTED})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(pure.lead_id, lead_ids)
        self.assertNotIn(advanced.lead_id, lead_ids)

    def test_documents_received_status_filter_excludes_incomplete_and_verified(self):
        pure = _create_lead(lead_code="LST-DR-PURE", category=LeadCategory.FRESH)
        pure.status = LeadStatus.DOCUMENTS_RECEIVED
        pure.save(update_fields=["status", "updated_at"])
        product = loan_product_factory()
        pure_app = application_factory(customer=pure.customer, product=product)
        pure_app.lead = pure
        pure_app.status = ApplicationStatus.DOCUMENTS_RECEIVED
        pure_app.save(update_fields=["lead", "status", "updated_at"])
        pure.converted_application = pure_app
        pure.save(update_fields=["converted_application", "updated_at"])

        incomplete = _create_lead(lead_code="LST-DR-INC", category=LeadCategory.FRESH)
        incomplete.status = LeadStatus.DOCUMENTS_RECEIVED
        incomplete.save(update_fields=["status", "updated_at"])
        inc_app = application_factory(customer=incomplete.customer, product=product)
        inc_app.lead = incomplete
        inc_app.status = ApplicationStatus.DOCUMENTS_INCOMPLETE
        inc_app.save(update_fields=["lead", "status", "updated_at"])
        incomplete.converted_application = inc_app
        incomplete.save(update_fields=["converted_application", "updated_at"])

        verified = _create_lead(lead_code="LST-DR-VER", category=LeadCategory.FRESH)
        verified.status = LeadStatus.DOCUMENTS_RECEIVED
        verified.save(update_fields=["status", "updated_at"])
        ver_app = application_factory(customer=verified.customer, product=product)
        ver_app.lead = verified
        ver_app.status = ApplicationStatus.DOCUMENTS_VERIFIED
        ver_app.save(update_fields=["lead", "status", "updated_at"])
        verified.converted_application = ver_app
        verified.save(update_fields=["converted_application", "updated_at"])

        response = self.client.get(
            reverse("lead-list"),
            {"status": LeadStatus.DOCUMENTS_RECEIVED},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(pure.lead_id, lead_ids)
        self.assertNotIn(incomplete.lead_id, lead_ids)
        self.assertNotIn(verified.lead_id, lead_ids)

    def test_not_interested_status_filter_excludes_rejected_applications(self):
        pure = _create_lead(lead_code="LST-NI-PURE", category=LeadCategory.FRESH)
        pure.status = LeadStatus.NOT_INTERESTED
        pure.close_reason = LeadCloserType.NOT_INTERESTED
        pure.save(update_fields=["status", "close_reason", "updated_at"])

        rejected_app_lead = _create_lead(lead_code="LST-NI-REJ", category=LeadCategory.FRESH)
        rejected_app_lead.status = LeadStatus.NOT_INTERESTED
        rejected_app_lead.close_reason = LeadCloserType.NOT_INTERESTED
        rejected_app_lead.save(update_fields=["status", "close_reason", "updated_at"])
        product = loan_product_factory()
        application = application_factory(customer=rejected_app_lead.customer, product=product)
        application.lead = rejected_app_lead
        application.status = ApplicationStatus.REJECTED
        application.save(update_fields=["lead", "status", "updated_at"])
        rejected_app_lead.converted_application = application
        rejected_app_lead.save(update_fields=["converted_application", "updated_at"])

        response = self.client.get(
            reverse("lead-list"),
            {"status": LeadStatus.NOT_INTERESTED},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(pure.lead_id, lead_ids)
        self.assertNotIn(rejected_app_lead.lead_id, lead_ids)

    def test_loan_running_status_filter_matches_lead_status_only(self):
        pure = _create_lead(lead_code="LST-LR-PURE", category=LeadCategory.FRESH)
        pure.status = LeadStatus.LOAN_RUNNING
        pure.save(update_fields=["status", "updated_at"])

        disbursed_lead = _create_lead(lead_code="LST-LR-DISB", category=LeadCategory.FRESH)
        disbursed_lead.status = LeadStatus.LOAN_RUNNING
        disbursed_lead.save(update_fields=["status", "updated_at"])
        product = loan_product_factory()
        application = application_factory(customer=disbursed_lead.customer, product=product)
        application.lead = disbursed_lead
        application.status = ApplicationStatus.DISBURSED
        application.save(update_fields=["lead", "status", "updated_at"])
        disbursed_lead.converted_application = application
        disbursed_lead.save(update_fields=["converted_application", "updated_at"])

        other = _create_lead(lead_code="LST-LR-OTHER", category=LeadCategory.FRESH)

        response = self.client.get(
            reverse("lead-list"),
            {"status": LeadStatus.LOAN_RUNNING},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = {row["lead_id"] for row in response.data["data"]["results"]}
        self.assertIn(pure.lead_id, lead_ids)
        self.assertIn(disbursed_lead.lead_id, lead_ids)
        self.assertNotIn(other.lead_id, lead_ids)

    def test_summary_fresh_reloan_counts_exclude_approved_applications(self):
        approved_lead = _create_lead(lead_code="LCT-SUM-001", category=LeadCategory.FRESH)
        product = loan_product_factory()
        application = application_factory(customer=approved_lead.customer, product=product)
        application.lead = approved_lead
        application.status = ApplicationStatus.APPROVED
        application.save(update_fields=["lead", "status", "updated_at"])
        approved_lead.converted_application = application
        approved_lead.save(update_fields=["converted_application", "updated_at"])

        _create_lead(lead_code="LCT-SUM-002", category=LeadCategory.FRESH)
        _create_lead(lead_code="LCT-SUM-003", category=LeadCategory.RELOAN)

        response = self.client.get(reverse("lead-summary"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = response.data["data"]
        self.assertEqual(counts["fresh"], 1)
        self.assertEqual(counts["reloan"], 1)
