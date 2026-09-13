from django.conf import settings
from django.db import models

from apps.core.models import UUIDPrimaryKeyModel


class TransactionType(models.TextChoices):
    DISBURSEMENT = "disbursement", "Disbursement"
    FEE = "fee", "Processing Fee"
    INTEREST = "interest", "Interest"
    REPAYMENT = "repayment", "Repayment"
    PENALTY = "penalty", "Penalty"
    REVERSAL = "reversal", "Reversal"
    SETTLEMENT = "settlement", "Settlement"
    WRITEOFF = "writeoff", "Write Off"


class LoanLedgerEntry(UUIDPrimaryKeyModel):
    """Append-only loan ledger — authoritative source for outstanding balance."""

    loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.PROTECT,
        related_name="ledger_entries",
    )
    transaction_date = models.DateTimeField(db_index=True)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)
    debit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance_after = models.DecimalField(max_digits=14, decimal_places=2)
    narration = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name_plural = "Loan ledger entries"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["loan", "-created_at"]),
            models.Index(fields=["loan", "-transaction_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(debit_amount__gte=0) & models.Q(credit_amount__gte=0),
                name="ledger_amounts_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.loan_id} {self.transaction_type} {self.balance_after}"
