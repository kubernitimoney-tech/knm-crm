import pytest
from tests.factories import UserFactory, application_factory

from apps.applications.models import ApplicationDecision
from apps.customers.models import CustomerBankAccount
from apps.leads.utils.lead_enrichment import (
    resolve_beneficiary_disbursal_defaults,
    resolve_company_disbursal_account,
    resolve_customer_salary_account,
)
from apps.organization.models import Branch, CompanyAccount


def _branch(name: str, code: str) -> Branch:
    return Branch.objects.create(
        branch_code=code,
        branch_name=name,
        bank_name="Test Bank",
        address_line1="Line 1",
        city="Mumbai",
        state="Maharashtra",
        mobile_no="9999999999",
    )


def _company_account(*, branch=None, account_number: str, is_default: bool = False):
    return CompanyAccount.objects.create(
        branch=branch,
        account_name=f"Account {account_number}",
        account_number=account_number,
        ifsc_code="HDFC0001234",
        bank_name="HDFC Bank",
        is_active=True,
        is_default=is_default,
    )


@pytest.mark.django_db
class TestResolveCompanyDisbursalAccount:
    def test_prefers_branch_specific_account(self):
        branch_a = _branch("Mumbai", "MUM")
        branch_b = _branch("Delhi", "DEL")
        _company_account(branch=branch_b, account_number="1111111111", is_default=True)
        branch_account = _company_account(branch=branch_a, account_number="2222222222")

        resolved = resolve_company_disbursal_account(branch=branch_a)

        assert resolved is not None
        assert resolved.account_number == "2222222222"

    def test_falls_back_to_global_account_when_branch_has_none(self):
        branch_a = _branch("Mumbai", "MUM")
        branch_b = _branch("Delhi", "DEL")
        _company_account(branch=branch_b, account_number="1111111111")
        global_account = _company_account(branch=None, account_number="3333333333", is_default=True)

        resolved = resolve_company_disbursal_account(branch=branch_a)

        assert resolved is not None
        assert resolved.account_number == "3333333333"
        assert resolved.id == global_account.id

    def test_falls_back_to_default_account_on_other_branch(self):
        branch_a = _branch("Mumbai", "MUM")
        branch_b = _branch("Delhi", "DEL")
        default_account = _company_account(
            branch=branch_b,
            account_number="4444444444",
            is_default=True,
        )

        resolved = resolve_company_disbursal_account(branch=branch_a)

        assert resolved is not None
        assert resolved.account_number == "4444444444"
        assert resolved.id == default_account.id


@pytest.mark.django_db
class TestResolveBeneficiaryDisbursalDefaults:
    def test_prefills_salary_account_without_lender_branch(self):
        application = application_factory()
        branch = _branch("Pune", "PUN")
        application.branch = branch
        application.save(update_fields=["branch"])
        user = UserFactory()
        ApplicationDecision.objects.create(
            application=application,
            decision="approved",
            decided_by=user,
            sanction_details={"salary_account": "9876543210"},
        )

        assert resolve_customer_salary_account(application) == "9876543210"
        defaults = resolve_beneficiary_disbursal_defaults(application)

        assert defaults["account_number"] == "9876543210"
        assert defaults["branch"] == ""

    def test_prefers_customer_salary_bank_account_over_sanction(self):
        application = application_factory()
        user = UserFactory()
        ApplicationDecision.objects.create(
            application=application,
            decision="approved",
            decided_by=user,
            sanction_details={"salary_account": "9876543210"},
        )
        CustomerBankAccount.objects.create(
            customer=application.customer,
            account_number="5555555555",
            ifsc_code="HDFC0001234",
            bank_name="HDFC",
            is_salary_account=True,
        )

        assert resolve_customer_salary_account(application) == "5555555555"

    def test_prefills_branch_from_ifsc_when_bank_account_has_ifsc(self):
        from unittest.mock import patch

        application = application_factory()
        CustomerBankAccount.objects.create(
            customer=application.customer,
            account_number="1234567890",
            ifsc_code="CBIN0200037",
            bank_name="",
            is_salary_account=True,
        )

        with patch(
            "apps.leads.utils.lead_enrichment.resolve_ifsc_bank_details",
            return_value={"bank_name": "Central Bank Of India", "branch": "Gopalganj"},
        ):
            defaults = resolve_beneficiary_disbursal_defaults(application)

        assert defaults["ifsc_code"] == "CBIN0200037"
        assert defaults["bank_name"] == "Central Bank Of India"
        assert defaults["branch"] == "Gopalganj"

    def test_falls_back_to_customer_salary_bank_account(self):
        application = application_factory()
        CustomerBankAccount.objects.create(
            customer=application.customer,
            account_number="1234567890",
            ifsc_code="SBIN0001234",
            bank_name="SBI",
            is_salary_account=True,
        )

        defaults = resolve_beneficiary_disbursal_defaults(application)

        assert defaults["account_number"] == "1234567890"
        assert defaults["ifsc_code"] == "SBIN0001234"
        assert defaults["bank_name"] == "SBI"
