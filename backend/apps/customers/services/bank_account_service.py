from apps.applications.models import ApplicationDecision, LoanApplication
from apps.core.encryption import blind_hash
from apps.customers.models import CustomerBankAccount


class BankAccountServiceError(Exception):
    pass


def normalize_account_number(account_number: str | None) -> str:
    return (account_number or "").strip().upper()


class BankAccountService:
    @classmethod
    def is_account_number_taken(
        cls,
        account_number: str | None,
        *,
        customer_id=None,
        application_id=None,
    ) -> bool:
        normalized = normalize_account_number(account_number)
        if not normalized:
            return False

        account_hash = blind_hash(account_number)
        if not account_hash:
            return False

        bank_qs = CustomerBankAccount.objects.filter(account_hash=account_hash)
        if customer_id is not None:
            bank_qs = bank_qs.exclude(customer_id=customer_id)
        if bank_qs.exists():
            return True

        app_qs = LoanApplication.objects.filter(
            is_deleted=False,
            disbursal_sheet_details__account_number__iexact=normalized,
        )
        if application_id is not None:
            app_qs = app_qs.exclude(id=application_id)
        if customer_id is not None:
            app_qs = app_qs.exclude(customer_id=customer_id)
        if app_qs.exists():
            return True

        decision_qs = ApplicationDecision.objects.filter(
            application__is_deleted=False,
            sanction_details__salary_account__iexact=normalized,
        )
        if application_id is not None:
            decision_qs = decision_qs.exclude(application_id=application_id)
        if customer_id is not None:
            decision_qs = decision_qs.exclude(application__customer_id=customer_id)
        if decision_qs.exists():
            return True

        return False

    @classmethod
    def assert_account_number_available(
        cls,
        account_number: str | None,
        *,
        customer_id=None,
        application_id=None,
    ) -> None:
        if cls.is_account_number_taken(
            account_number,
            customer_id=customer_id,
            application_id=application_id,
        ):
            raise BankAccountServiceError(
                "This account number is already associated with another customer."
            )
