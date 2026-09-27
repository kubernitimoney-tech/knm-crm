from datetime import date
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory, grant_permission

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource
from apps.loans.models import Loan, LoanStatus
from apps.loans.selectors.loan_selectors import visible_loans_for


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, rm, cm) -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_rm=rm,
        assigned_cm=cm,
    )


def _create_disbursed_loan(*, user, lead, rm, cm, account_suffix: str) -> Loan:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": Decimal("50000"),
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status"])

    return Loan.objects.create(
        loan_account_number=f"LN-{account_suffix}",
        application=application,
        customer=lead.customer,
        product=product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=LoanStatus.ACTIVE,
        disbursed_at=timezone.now(),
    )


def _create_finance_pipeline_loan(*, user, lead, rm, cm, account_suffix: str) -> Loan:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": Decimal("50000"),
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.DISBURSAL_SHEET_SENT
    application.save(update_fields=["lead", "status"])

    return Loan.objects.create(
        loan_account_number=f"LN-FIN-{account_suffix}",
        application=application,
        customer=lead.customer,
        product=product,
        principal_amount=application.requested_amount,
        total_repayable=application.requested_amount,
        due_date=date.today(),
        status=LoanStatus.ACTIVE,
        disbursed_at=None,
    )


class VisibleLoansForTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_rm_and_cm_only_see_assigned_loans(self):
        rm2 = UserFactory(email="rm2-loans@test.com")
        cm2 = UserFactory(email="cm2-loans@test.com")
        rm3 = UserFactory(email="rm3-loans@test.com")
        cm3 = UserFactory(email="cm3-loans@test.com")
        for user, slug in (
            (rm2, "relationship-manager"),
            (cm2, "credit-manager"),
            (rm3, "relationship-manager"),
            (cm3, "credit-manager"),
        ):
            _assign_role(user, slug)

        lead_one = _create_lead(lead_code="LD-LN-01", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD-LN-02", rm=rm3, cm=cm3)
        loan_one = _create_disbursed_loan(
            user=rm2, lead=lead_one, rm=rm2, cm=cm2, account_suffix="001"
        )
        loan_two = _create_disbursed_loan(
            user=rm3, lead=lead_two, rm=rm3, cm=cm3, account_suffix="002"
        )

        rm2_ids = {row.id for row in visible_loans_for(rm2)}
        cm2_ids = {row.id for row in visible_loans_for(cm2)}
        rm3_ids = {row.id for row in visible_loans_for(rm3)}

        self.assertEqual(rm2_ids, {loan_one.id})
        self.assertEqual(cm2_ids, {loan_one.id})
        self.assertEqual(rm3_ids, {loan_two.id})
        self.assertNotIn(loan_two.id, rm2_ids)

    def test_collection_officer_sees_disbursed_loans_only(self):
        rm = UserFactory(email="rm-co-loans@test.com")
        cm = UserFactory(email="cm-co-loans@test.com")
        collector = UserFactory(email="collector-loans@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(collector, "collection-manager")

        lead_disbursed = _create_lead(lead_code="LD-LN-03", rm=rm, cm=cm)
        lead_finance = _create_lead(lead_code="LD-LN-04", rm=rm, cm=cm)
        disbursed = _create_disbursed_loan(
            user=rm, lead=lead_disbursed, rm=rm, cm=cm, account_suffix="003"
        )
        _create_finance_pipeline_loan(
            user=rm, lead=lead_finance, rm=rm, cm=cm, account_suffix="004"
        )

        visible = {row.id for row in visible_loans_for(collector)}
        self.assertEqual(visible, {disbursed.id})

    def test_finance_sees_finance_pipeline_loans(self):
        rm = UserFactory(email="rm-fin-loans@test.com")
        cm = UserFactory(email="cm-fin-loans@test.com")
        finance = UserFactory(email="finance-loans@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(finance, "account-finance")

        lead = _create_lead(lead_code="LD-LN-05", rm=rm, cm=cm)
        finance_loan = _create_finance_pipeline_loan(
            user=rm, lead=lead, rm=rm, cm=cm, account_suffix="005"
        )

        visible = {row.id for row in visible_loans_for(finance)}
        self.assertIn(finance_loan.id, visible)

    def test_admin_sees_all_loans(self):
        admin = UserFactory(email="admin-loans@test.com")
        _assign_role(admin, "admin")
        rm = UserFactory(email="rm-admin-loans@test.com")
        cm = UserFactory(email="cm-admin-loans@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead_one = _create_lead(lead_code="LD-LN-06", rm=rm, cm=cm)
        lead_two = _create_lead(lead_code="LD-LN-07", rm=rm, cm=cm)
        loan_one = _create_disbursed_loan(
            user=rm, lead=lead_one, rm=rm, cm=cm, account_suffix="006"
        )
        loan_two = _create_disbursed_loan(
            user=rm, lead=lead_two, rm=rm, cm=cm, account_suffix="007"
        )

        visible = {row.id for row in visible_loans_for(admin)}
        self.assertEqual(visible, {loan_one.id, loan_two.id})


class LoanListAPIScopingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_loan_list_api_scoped_for_cm(self):
        rm = UserFactory(email="rm-api-loans@test.com")
        cm = UserFactory(email="cm-api-loans@test.com")
        outsider = UserFactory(email="outsider-api-loans@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        grant_permission(outsider, "loan.view")

        lead = _create_lead(lead_code="LD-LN-API-01", rm=rm, cm=cm)
        loan = _create_disbursed_loan(user=rm, lead=lead, rm=rm, cm=cm, account_suffix="API01")

        client = APIClient()
        client.force_authenticate(user=cm)
        response = client.get("/api/v1/loans/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data["data"]["results"]}
        self.assertEqual(ids, {str(loan.id)})

        client.force_authenticate(user=outsider)
        outsider_response = client.get("/api/v1/loans/")
        self.assertEqual(outsider_response.status_code, status.HTTP_200_OK)
        self.assertEqual(outsider_response.data["data"]["results"], [])

    def test_loan_retrieve_hides_foreign_loan(self):
        rm = UserFactory(email="rm-retrieve@test.com")
        cm = UserFactory(email="cm-retrieve@test.com")
        outsider = UserFactory(email="outsider-retrieve@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        grant_permission(outsider, "loan.view")

        lead = _create_lead(lead_code="LD-LN-API-02", rm=rm, cm=cm)
        loan = _create_disbursed_loan(user=rm, lead=lead, rm=rm, cm=cm, account_suffix="API02")

        client = APIClient()
        client.force_authenticate(user=outsider)
        response = client.get(f"/api/v1/loans/{loan.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
