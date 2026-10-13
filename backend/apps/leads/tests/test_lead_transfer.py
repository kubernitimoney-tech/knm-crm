from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory, grant_permission

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus, LoanApplication
from apps.leads.models import Lead, LeadAssignmentHistory, LeadCategory, LeadSource, LeadStatus
from apps.leads.services.lead_service import LeadService


def _create_lead(
    *,
    lead_code: str,
    customer,
    category=LeadCategory.FRESH,
    status=LeadStatus.FRESH,
    rm=None,
    cm=None,
) -> Lead:
    source, _ = LeadSource.objects.get_or_create(
        slug="web",
        defaults={"name": "Web"},
    )
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        category=category,
        status=status,
        assigned_rm=rm,
        assigned_cm=cm,
        required_amount=Decimal("10000"),
    )


def _assign_role(user, slug: str, name: str):
    role, _ = Role.objects.get_or_create(
        slug=slug,
        defaults={"name": name, "is_active": True},
    )
    UserRole.objects.get_or_create(user=user, role=role)


def _assign_rm_role(user):
    _assign_role(user, "relationship-manager", "Relationship Manager")


def _assign_cm_role(user):
    _assign_role(user, "credit-manager", "Credit Manager")


class LeadTransferPreservesCategoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")
        cls.admin = UserFactory(email="transfer-admin@test.com")
        cls.old_rm = UserFactory(email="transfer-old-rm@test.com")
        cls.new_rm = UserFactory(email="transfer-new-rm@test.com")
        cls.old_cm = UserFactory(email="transfer-old-cm@test.com")
        cls.new_cm = UserFactory(email="transfer-new-cm@test.com")
        _assign_role(cls.admin, "admin", "Administrator")
        _assign_rm_role(cls.old_rm)
        _assign_rm_role(cls.new_rm)
        _assign_cm_role(cls.old_cm)
        _assign_cm_role(cls.new_cm)

    def test_transfer_preserves_fresh_category_and_fresh_status(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-FRESH-001",
            customer=customer,
            category=LeadCategory.FRESH,
            status=LeadStatus.FRESH,
            rm=self.old_rm,
        )

        transferred = LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_rm=self.new_rm,
            remarks="Handover",
        )

        transferred.refresh_from_db()
        self.assertEqual(transferred.category, LeadCategory.FRESH)
        self.assertEqual(transferred.status, LeadStatus.FRESH)
        self.assertEqual(transferred.assigned_rm_id, self.new_rm.id)

    def test_transfer_preserves_reloan_status(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-RELOAN-002",
            customer=customer,
            category=LeadCategory.RELOAN,
            status=LeadStatus.RELOAN,
            rm=self.old_rm,
        )

        transferred = LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_rm=self.new_rm,
        )

        transferred.refresh_from_db()
        self.assertEqual(transferred.category, LeadCategory.RELOAN)
        self.assertEqual(transferred.status, LeadStatus.RELOAN)
        self.assertEqual(transferred.assigned_rm_id, self.new_rm.id)

    def test_transfer_preserves_reloan_category_and_interested_status(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-RELOAN-001",
            customer=customer,
            category=LeadCategory.RELOAN,
            status=LeadStatus.INTERESTED,
            rm=self.old_rm,
        )

        transferred = LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_rm=self.new_rm,
        )

        transferred.refresh_from_db()
        self.assertEqual(transferred.category, LeadCategory.RELOAN)
        self.assertEqual(transferred.status, LeadStatus.INTERESTED)
        self.assertEqual(transferred.assigned_rm_id, self.new_rm.id)

    def test_transfer_syncs_linked_application_rm_without_changing_status(self):
        from apps.products.models import LoanProduct

        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-APP-001",
            customer=customer,
            category=LeadCategory.RELOAN,
            status=LeadStatus.DOCUMENTS_RECEIVED,
            rm=self.old_rm,
        )
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = LoanApplication.objects.create(
            application_number="APP-TR-001",
            customer=customer,
            lead=lead,
            product=product,
            requested_amount=Decimal("50000"),
            tenure_value=30,
            tenure_unit=product.tenure_unit,
            status=ApplicationStatus.DOCUMENTS_RECEIVED,
            assigned_rm=self.old_rm,
        )
        lead.converted_application = application
        lead.save(update_fields=["converted_application"])

        LeadService.transfer_lead(user=self.admin, lead=lead, new_rm=self.new_rm)

        application.refresh_from_db()
        lead.refresh_from_db()
        self.assertEqual(lead.category, LeadCategory.RELOAN)
        self.assertEqual(lead.status, LeadStatus.DOCUMENTS_RECEIVED)
        self.assertEqual(application.status, ApplicationStatus.DOCUMENTS_RECEIVED)
        self.assertEqual(application.assigned_rm_id, self.new_rm.id)

    def test_transfer_reassigns_rm_and_cm_together(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-BOTH-001",
            customer=customer,
            rm=self.old_rm,
            cm=self.old_cm,
        )

        transferred = LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_rm=self.new_rm,
            new_cm=self.new_cm,
            remarks="Handover both",
        )

        transferred.refresh_from_db()
        self.assertEqual(transferred.assigned_rm_id, self.new_rm.id)
        self.assertEqual(transferred.assigned_cm_id, self.new_cm.id)
        history = LeadAssignmentHistory.objects.filter(lead=lead).latest("created_at")
        self.assertEqual(history.old_rm_id, self.old_rm.id)
        self.assertEqual(history.new_rm_id, self.new_rm.id)
        self.assertEqual(history.old_cm_id, self.old_cm.id)
        self.assertEqual(history.new_cm_id, self.new_cm.id)

    def test_transfer_cm_only_keeps_rm(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-CM-001",
            customer=customer,
            rm=self.old_rm,
            cm=self.old_cm,
        )

        transferred = LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_cm=self.new_cm,
        )

        transferred.refresh_from_db()
        self.assertEqual(transferred.assigned_rm_id, self.old_rm.id)
        self.assertEqual(transferred.assigned_cm_id, self.new_cm.id)

    def test_transfer_syncs_linked_application_cm(self):
        from apps.products.models import LoanProduct

        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-APP-CM-001",
            customer=customer,
            rm=self.old_rm,
            cm=self.old_cm,
        )
        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        application = LoanApplication.objects.create(
            application_number="APP-TR-CM-001",
            customer=customer,
            lead=lead,
            product=product,
            requested_amount=Decimal("50000"),
            tenure_value=30,
            tenure_unit=product.tenure_unit,
            status=ApplicationStatus.DOCUMENTS_RECEIVED,
            assigned_rm=self.old_rm,
            assigned_cm=self.old_cm,
        )

        LeadService.transfer_lead(
            user=self.admin,
            lead=lead,
            new_rm=self.new_rm,
            new_cm=self.new_cm,
        )

        application.refresh_from_db()
        self.assertEqual(application.assigned_rm_id, self.new_rm.id)
        self.assertEqual(application.assigned_cm_id, self.new_cm.id)

    def test_transfer_api_requires_lead_transfer_permission(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-API-403",
            customer=customer,
            rm=self.old_rm,
            cm=self.old_cm,
        )
        client = APIClient()
        client.force_authenticate(user=self.old_rm)
        response = client.post(
            reverse("lead-transfer", kwargs={"pk": lead.pk}),
            {"new_rm": str(self.new_rm.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_transfer_api_allows_user_with_lead_transfer(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="TR-API-200",
            customer=customer,
            rm=self.old_rm,
            cm=self.old_cm,
        )
        grant_permission(self.admin, "lead.transfer")
        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.post(
            reverse("lead-transfer", kwargs={"pk": lead.pk}),
            {"new_rm": str(self.new_rm.id), "new_cm": str(self.new_cm.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.assigned_rm_id, self.new_rm.id)
        self.assertEqual(lead.assigned_cm_id, self.new_cm.id)
