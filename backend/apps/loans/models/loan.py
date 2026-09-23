from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel
from apps.customers.models import Customer
from apps.organization.models import Branch
from apps.products.models import LoanProduct, ProcessingFeeType


class LoanStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    OVERDUE = "overdue", "Overdue"
    DEFAULTED = "defaulted", "Defaulted"
    CLOSED = "closed", "Closed"


class LoanClosureType(models.TextChoices):
    NORMAL = "normal", "Closed"
    PAYDAY_PRECLOSED = "payday_preclosed", "payday Pre-closed"
    PRE_CLOSED = "pre_closed", "Pre Closure"
    SETTLEMENT = "settlement", "Settlement"
    WRITE_OFF = "write_off", "Write Off"


class DisbursementStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    REVERSED = "reversed", "Reversed"


class Loan(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel, SoftDeleteModel):
    loan_account_number = models.CharField(max_length=30, unique=True, db_index=True)
    application = models.OneToOneField(
        "applications.LoanApplication",
        on_delete=models.PROTECT,
        related_name="loan",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="loans",
    )
    product = models.ForeignKey(
        LoanProduct,
        on_delete=models.PROTECT,
        related_name="loans",
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="loans",
        null=True,
        blank=True,
    )
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_repayable = models.DecimalField(max_digits=14, decimal_places=2)
    product_snapshot = models.JSONField(default=dict, blank=True)
    due_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=LoanStatus.choices,
        default=LoanStatus.ACTIVE,
        db_index=True,
    )
    disbursed_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Loan"
        indexes = [
            models.Index(fields=["loan_account_number", "status"]),
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["due_date", "status"]),
        ]

    @property
    def outstanding_balance(self):
        from apps.ledger.selectors.balance_selectors import get_latest_balance

        return get_latest_balance(self.id)

    def _approved_decision(self):
        application = getattr(self, "application", None)
        if application is None:
            return None
        return application.decisions.filter(decision="approved").order_by("-decided_at").first()

    @property
    def interest_rate(self):
        """Sanctioned ROI captured at loan creation."""
        from decimal import Decimal

        snapshot = self.product_snapshot or {}
        if snapshot.get("interest_rate") not in (None, ""):
            return Decimal(str(snapshot["interest_rate"]))

        decision = self._approved_decision()
        if decision and decision.interest_rate is not None:
            return decision.interest_rate
        return self.product.interest_rate if self.product_id else Decimal("0")

    @property
    def processing_fee(self):
        """Sanctioned PF captured at loan creation."""
        from decimal import Decimal

        snapshot = self.product_snapshot or {}
        if snapshot.get("processing_fee") not in (None, ""):
            return Decimal(str(snapshot["processing_fee"]))

        decision = self._approved_decision()
        if decision and decision.processing_fee is not None:
            return decision.processing_fee

        product = self.product
        if product.processing_fee_type == ProcessingFeeType.PERCENTAGE:
            return product.compute_processing_fee(self.principal_amount)
        return product.processing_fee

    def check_user_access(self, user) -> bool:
        return self.application.check_user_access(user)

    def __str__(self):
        return self.loan_account_number


class LoanDisbursement(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.ForeignKey(
        Loan,
        on_delete=models.PROTECT,
        related_name="disbursements",
    )
    lender_account = models.ForeignKey(
        "organization.LenderBankAccount",
        on_delete=models.PROTECT,
        related_name="disbursements",
        null=True,
        blank=True,
    )
    beneficiary_account = models.ForeignKey(
        "customers.CustomerBankAccount",
        on_delete=models.PROTECT,
        related_name="disbursements",
        null=True,
        blank=True,
    )
    disbursed_amount = models.DecimalField(max_digits=14, decimal_places=2)
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2)
    deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_mode = models.CharField(max_length=20, default="NEFT")
    utr_reference = models.CharField(max_length=100, unique=True)
    disbursed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    disbursed_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=DisbursementStatus.choices,
        default=DisbursementStatus.COMPLETED,
    )
    ledger_entry = models.ForeignKey(
        "ledger.LoanLedgerEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disbursements",
    )
    remarks = models.TextField(blank=True)

    class Meta:
        ordering = ["-disbursed_at"]


class LoanPenalty(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name="penalties")
    penalty_date = models.DateField()
    penalty_amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.CharField(max_length=100, default="overdue")
    ledger_entry = models.ForeignKey(
        "ledger.LoanLedgerEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="penalties",
    )
    waived = models.BooleanField(default=False)
    waived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waived_penalties",
    )

    class Meta:
        verbose_name_plural = "Loan penalties"
        ordering = ["-penalty_date"]


class LoanSettlement(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.OneToOneField(Loan, on_delete=models.PROTECT, related_name="settlement")
    settlement_amount = models.DecimalField(max_digits=14, decimal_places=2)
    waiver_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_settlements",
    )
    settled_at = models.DateTimeField()
    ledger_entry = models.ForeignKey(
        "ledger.LoanLedgerEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="settlements",
    )


class LoanWriteOff(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="write_offs")
    write_off_amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_write_offs",
    )
    written_off_at = models.DateTimeField()
    ledger_entry = models.ForeignKey(
        "ledger.LoanLedgerEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="write_offs",
    )

    class Meta:
        ordering = ["-written_off_at"]


class LoanStatusHistory(UUIDPrimaryKeyModel, TimeStampedModel):
    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=30, blank=True, default="")
    to_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loan_status_changes",
    )
    remarks = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Loan Status History"
        verbose_name_plural = "Loan Status Histories"
        ordering = ["-changed_at"]
