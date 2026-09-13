from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from tests.factories import UserFactory, customer_factory

from apps.applications.models import ApplicationStatus, LoanApplication
from apps.leads.models import Lead, LeadCategory, LeadSource, LeadStatus
from apps.leads.services.lead_service import LeadService


def _create_lead(
    *,
    lead_code: str,
    customer,
    category=LeadCategory.FRESH,
    status=LeadStatus.FRESH,
    rm=None,
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
        required_amount=Decimal("10000"),
    )


def _assign_rm_role(user):
    from apps.accounts.models import Role, UserRole

    role, _ = Role.objects.get_or_create(
        slug="relationship-manager",
        defaults={"name": "Relationship Manager", "is_active": True},
    )
    UserRole.objects.get_or_create(user=user, role=role)


class LeadTransferPreservesCategoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")
        cls.admin = UserFactory(email="transfer-admin@test.com")
        cls.old_rm = UserFactory(email="transfer-old-rm@test.com")
        cls.new_rm = UserFactory(email="transfer-new-rm@test.com")
        _assign_rm_role(cls.old_rm)
        _assign_rm_role(cls.new_rm)

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
