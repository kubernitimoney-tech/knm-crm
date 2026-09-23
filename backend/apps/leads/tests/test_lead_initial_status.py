from datetime import date
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from tests.factories import UserFactory, customer_factory

from apps.applications.models import ApplicationStatus, LoanApplication
from apps.leads.models import Lead, LeadCategory, LeadSource, LeadStatus
from apps.leads.services.lead_initial_status_service import (
    customer_has_disbursed_loan,
    resolve_initial_lead_category,
    resolve_initial_lead_status,
)
from apps.leads.services.lead_service import LeadService
from apps.loans.models import Loan, LoanStatus


def _create_lead(
    *,
    lead_code: str,
    customer,
    status=LeadStatus.FRESH,
    category=LeadCategory.FRESH,
    application: LoanApplication | None = None,
) -> Lead:
    source, _ = LeadSource.objects.get_or_create(
        slug="web",
        defaults={"name": "Web"},
    )
    lead = Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        status=status,
        category=category,
    )
    if application is not None:
        application.lead = lead
        application.save(update_fields=["lead"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application"])
    return lead


def _create_application(
    *, customer, lead=None, app_status=ApplicationStatus.INTERESTED
) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = LoanApplication.objects.create(
        application_number=f"APP-{lead.lead_id if lead else 'X'}",
        customer=customer,
        product=product,
        requested_amount=Decimal("50000"),
        tenure_value=30,
        tenure_unit=product.tenure_unit,
        status=app_status,
    )
    if lead is not None:
        application.lead = lead
        application.save(update_fields=["lead"])
        lead.converted_application = application
        lead.save(update_fields=["converted_application"])
    return application


def _create_loan(*, application, status=LoanStatus.ACTIVE) -> Loan:
    loan = Loan.objects.create(
        loan_account_number=f"LN-{application.application_number}",
        application=application,
        customer=application.customer,
        product=application.product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=status,
        disbursed_at=timezone.now(),
    )
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["status"])
    return loan


class ResolveInitialLeadStatusTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_always_fresh_for_new_customer(self):
        customer = customer_factory()
        self.assertEqual(resolve_initial_lead_status(customer), LeadStatus.FRESH)
        self.assertEqual(resolve_initial_lead_category(customer), LeadCategory.FRESH)

    def test_fresh_for_returning_customer_without_disbursed_loan(self):
        customer = customer_factory()
        _create_lead(lead_code="PRIOR-002", customer=customer, status=LeadStatus.INTERESTED)
        self.assertFalse(customer_has_disbursed_loan(customer))
        self.assertEqual(resolve_initial_lead_status(customer), LeadStatus.FRESH)
        self.assertEqual(resolve_initial_lead_category(customer), LeadCategory.FRESH)

    def test_fresh_for_returning_customer_with_rejected_application(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="PRIOR-003", customer=customer, status=LeadStatus.NOT_INTERESTED
        )
        _create_application(customer=customer, lead=lead, app_status=ApplicationStatus.REJECTED)
        self.assertEqual(resolve_initial_lead_status(customer), LeadStatus.FRESH)

    def test_fresh_for_returning_customer_with_disbursal_sheet_sent_only(self):
        customer = customer_factory()
        lead = _create_lead(lead_code="PRIOR-004", customer=customer, status=LeadStatus.INTERESTED)
        _create_application(
            customer=customer, lead=lead, app_status=ApplicationStatus.DISBURSAL_SHEET_SENT
        )
        self.assertEqual(resolve_initial_lead_status(customer), LeadStatus.FRESH)

    def test_reloan_only_after_disbursed_loan(self):
        customer = customer_factory()
        lead = _create_lead(
            lead_code="PRIOR-001",
            customer=customer,
            status=LeadStatus.LOAN_RUNNING,
        )
        application = _create_application(customer=customer, lead=lead)
        _create_loan(application=application, status=LoanStatus.ACTIVE)
        self.assertTrue(customer_has_disbursed_loan(customer))
        self.assertEqual(resolve_initial_lead_status(customer), LeadStatus.RELOAN)
        self.assertEqual(resolve_initial_lead_category(customer), LeadCategory.RELOAN)


class LeadCreateCategoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")
        cls.user = UserFactory(email="lead-create-category@test.com")

    def test_first_lead_is_fresh_status(self):
        customer = customer_factory()
        lead = LeadService.create_lead(
            user=self.user,
            customer=customer,
            data={"required_amount": Decimal("10000")},
        )
        self.assertEqual(lead.category, LeadCategory.FRESH)
        self.assertEqual(lead.status, LeadStatus.FRESH)

    def test_second_lead_stays_fresh_until_prior_loan_disbursed(self):
        customer = customer_factory()
        first = LeadService.create_lead(
            user=self.user,
            customer=customer,
            data={"required_amount": Decimal("10000")},
        )
        _create_application(
            customer=customer, lead=first, app_status=ApplicationStatus.DOCUMENTS_RECEIVED
        )

        second = LeadService.create_lead(
            user=self.user,
            customer=customer,
            data={"required_amount": Decimal("15000")},
        )
        self.assertEqual(second.category, LeadCategory.FRESH)
        self.assertEqual(second.status, LeadStatus.FRESH)

    def test_next_lead_is_reloan_after_disbursed_loan(self):
        customer = customer_factory()
        prior = LeadService.create_lead(
            user=self.user,
            customer=customer,
            data={"required_amount": Decimal("10000")},
        )
        application = _create_application(customer=customer, lead=prior)
        _create_loan(application=application, status=LoanStatus.ACTIVE)

        lead = LeadService.create_lead(
            user=self.user,
            customer=customer,
            data={"required_amount": Decimal("20000")},
        )
        self.assertEqual(lead.category, LeadCategory.RELOAN)
        self.assertEqual(lead.status, LeadStatus.RELOAN)
