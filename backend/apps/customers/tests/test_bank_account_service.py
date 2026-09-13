import pytest
from django.db import IntegrityError
from tests.factories import UserFactory, application_factory, customer_factory

from apps.applications.models import ApplicationDecision, ApplicationStatus
from apps.applications.services.application_service import (
    ApplicationService,
    ApplicationServiceError,
)
from apps.customers.models import CustomerBankAccount
from apps.customers.services.bank_account_service import BankAccountService


@pytest.mark.django_db
class TestBankAccountService:
    def test_allows_same_customer_to_reuse_account_number(self):
        customer = customer_factory()
        CustomerBankAccount.objects.create(
            customer=customer,
            account_number="1234567890",
            ifsc_code="HDFC0001234",
            bank_name="HDFC Bank",
            is_salary_account=True,
        )

        assert (
            BankAccountService.is_account_number_taken(
                "1234567890",
                customer_id=customer.id,
            )
            is False
        )

    def test_rejects_account_number_used_by_another_customer_bank_account(self):
        customer = customer_factory()
        other_customer = customer_factory(email="other@example.com", mobile_number="8888888888")
        CustomerBankAccount.objects.create(
            customer=other_customer,
            account_number="1234567890",
            ifsc_code="HDFC0001234",
            bank_name="HDFC Bank",
            is_salary_account=True,
        )

        assert (
            BankAccountService.is_account_number_taken(
                "1234567890",
                customer_id=customer.id,
            )
            is True
        )

    def test_rejects_account_number_used_in_another_customers_sanction(self):
        user = UserFactory()
        owner = application_factory()
        other = application_factory(
            email="other@example.com",
            mobile_number="7777777777",
        )
        ApplicationDecision.objects.create(
            application=other,
            decision="approved",
            decided_by=user,
            sanction_details={"salary_account": "9876543210"},
            created_by=user,
            updated_by=user,
        )

        assert (
            BankAccountService.is_account_number_taken(
                "9876543210",
                customer_id=owner.customer_id,
                application_id=owner.id,
            )
            is True
        )

    def test_rejects_account_number_used_in_another_customers_disbursal_sheet(self):
        owner = application_factory()
        other = application_factory(
            email="other@example.com",
            mobile_number="6666666666",
        )
        other.disbursal_sheet_details = {"account_number": "5555555555"}
        other.save(update_fields=["disbursal_sheet_details"])

        assert (
            BankAccountService.is_account_number_taken(
                "5555555555",
                customer_id=owner.customer_id,
                application_id=owner.id,
            )
            is True
        )

    def test_allows_same_application_to_keep_account_number(self):
        application = application_factory()
        application.disbursal_sheet_details = {"account_number": "4444444444"}
        application.save(update_fields=["disbursal_sheet_details"])

        assert (
            BankAccountService.is_account_number_taken(
                "4444444444",
                customer_id=application.customer_id,
                application_id=application.id,
            )
            is False
        )

    def test_customer_bank_account_hash_is_unique_in_database(self):
        customer_one = customer_factory()
        customer_two = customer_factory(email="dup@example.com", mobile_number="9555555555")
        CustomerBankAccount.objects.create(
            customer=customer_one,
            account_number="3333333333",
            ifsc_code="HDFC0001234",
            bank_name="HDFC Bank",
        )

        with pytest.raises(IntegrityError):
            CustomerBankAccount.objects.create(
                customer=customer_two,
                account_number="3333333333",
                ifsc_code="HDFC0001234",
                bank_name="HDFC Bank",
            )


@pytest.mark.django_db
class TestApplicationAccountNumberUniqueness:
    def test_decide_rejects_duplicate_salary_account(self):
        user = UserFactory()
        existing = application_factory()
        ApplicationDecision.objects.create(
            application=existing,
            decision="approved",
            decided_by=user,
            sanction_details={"salary_account": "1111222233"},
            created_by=user,
            updated_by=user,
        )

        pending = application_factory(
            email="pending@example.com",
            mobile_number="9444444444",
        )
        ApplicationService._advance_to_documents_verified(user=user, application=pending)

        with pytest.raises(ApplicationServiceError, match="already associated"):
            ApplicationService.decide(
                user=user,
                application=pending,
                decision="approved",
                approved_amount=pending.requested_amount,
                sanction_details={"salary_account": "1111222233", "cibil_score": "750"},
            )

    def test_submit_disbursal_sheet_rejects_duplicate_account_number(self):
        user = UserFactory()
        existing = application_factory()
        existing.status = ApplicationStatus.APPROVED
        existing.disbursal_sheet_details = {"account_number": "9999888877"}
        existing.save(update_fields=["status", "disbursal_sheet_details"])

        pending = application_factory(
            email="sheet@example.com",
            mobile_number="9333333333",
        )
        pending.status = ApplicationStatus.APPROVED
        pending.save(update_fields=["status"])

        with pytest.raises(ApplicationServiceError, match="already associated"):
            ApplicationService.submit_disbursal_sheet(
                user=user,
                application=pending,
                disbursal_details={
                    "account_number": "9999888877",
                    "ifsc_code": "HDFC0001234",
                },
            )
