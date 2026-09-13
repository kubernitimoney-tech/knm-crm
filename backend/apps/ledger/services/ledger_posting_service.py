from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.ledger.models import LoanLedgerEntry, TransactionType


class LedgerPostingError(Exception):
    pass


class LedgerPostingService:
    @staticmethod
    def get_balance(loan_id) -> Decimal:
        entry = (
            LoanLedgerEntry.objects.filter(loan_id=loan_id)
            .order_by("-created_at", "-id")
            .values_list("balance_after", flat=True)
            .first()
        )
        return entry if entry is not None else Decimal("0")

    @classmethod
    @transaction.atomic
    def post(
        cls,
        *,
        loan,
        transaction_type: str,
        debit_amount: Decimal = Decimal("0"),
        credit_amount: Decimal = Decimal("0"),
        reference_type: str = "",
        reference_id=None,
        narration: str = "",
        idempotency_key: str | None = None,
        user=None,
        transaction_date=None,
    ) -> LoanLedgerEntry:
        if idempotency_key:
            existing = LoanLedgerEntry.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        from apps.loans.models import Loan

        locked_loan = Loan.objects.select_for_update().get(pk=loan.pk)
        prior_balance = cls.get_balance(locked_loan.id)
        balance_after = prior_balance + debit_amount - credit_amount

        if balance_after < 0:
            raise LedgerPostingError("Ledger balance cannot go negative.")

        return LoanLedgerEntry.objects.create(
            loan=locked_loan,
            transaction_date=transaction_date or timezone.now(),
            transaction_type=transaction_type,
            reference_type=reference_type,
            reference_id=reference_id,
            debit_amount=debit_amount,
            credit_amount=credit_amount,
            balance_after=balance_after,
            narration=narration,
            idempotency_key=idempotency_key,
            created_by=user,
        )

    @classmethod
    def post_payday_loan_charges(
        cls,
        *,
        loan,
        principal: Decimal,
        processing_fee: Decimal,
        interest: Decimal,
        user=None,
    ) -> list[LoanLedgerEntry]:
        """Initial debit entries when a payday loan account is created."""
        entries = []
        base_key = str(loan.id)
        entries.append(
            cls.post(
                loan=loan,
                transaction_type=TransactionType.DISBURSEMENT,
                debit_amount=principal,
                reference_type="loan",
                reference_id=loan.id,
                narration="Principal sanctioned",
                idempotency_key=f"{base_key}-principal",
                user=user,
            )
        )
        if processing_fee > 0:
            entries.append(
                cls.post(
                    loan=loan,
                    transaction_type=TransactionType.FEE,
                    debit_amount=processing_fee,
                    reference_type="loan",
                    reference_id=loan.id,
                    narration="Processing fee",
                    idempotency_key=f"{base_key}-fee",
                    user=user,
                )
            )
        if interest > 0:
            entries.append(
                cls.post(
                    loan=loan,
                    transaction_type=TransactionType.INTEREST,
                    debit_amount=interest,
                    reference_type="loan",
                    reference_id=loan.id,
                    narration="Interest",
                    idempotency_key=f"{base_key}-interest",
                    user=user,
                )
            )
        return entries
