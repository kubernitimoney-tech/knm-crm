from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel


class PaymentMode(models.TextChoices):
    UPI = "upi", "UPI"
    IMPS = "imps", "IMPS"
    NEFT = "neft", "NEFT"
    RTGS = "rtgs", "RTGS"
    CHEQUE = "cheque", "Cheque"
    CASH = "cash", "Cash"


class RepaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    FAILED = "failed", "Failed"
    REVERSED = "reversed", "Reversed"


class LoanRepayment(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.PROTECT,
        related_name="repayments",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    utr = models.CharField(max_length=100, blank=True, db_index=True)
    payment_date = models.DateTimeField(db_index=True)
    gateway_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20,
        choices=RepaymentStatus.choices,
        default=RepaymentStatus.CONFIRMED,
    )
    ledger_entry = models.OneToOneField(
        "ledger.LoanLedgerEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="repayment",
    )
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collected_repayments",
    )
    remarks = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["loan", "-payment_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0),
                name="repayment_amount_positive",
            ),
        ]
