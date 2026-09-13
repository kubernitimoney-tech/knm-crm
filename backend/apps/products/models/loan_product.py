from decimal import Decimal

from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class TenureUnit(models.TextChoices):
    DAYS = "days", "Days"
    MONTHS = "months", "Months"


class InterestType(models.TextChoices):
    FLAT = "flat", "Flat"
    REDUCING = "reducing", "Reducing"
    FIXED = "fixed", "Fixed"


class ProcessingFeeType(models.TextChoices):
    FIXED = "fixed", "Fixed"
    PERCENTAGE = "percentage", "Percentage"


class LoanProduct(UUIDPrimaryKeyModel, TimeStampedModel):
    product_code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    min_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2)
    min_tenure = models.PositiveIntegerField(help_text="Minimum tenure in tenure_unit.")
    max_tenure = models.PositiveIntegerField(help_text="Maximum tenure in tenure_unit.")
    tenure_unit = models.CharField(
        max_length=10,
        choices=TenureUnit.choices,
        default=TenureUnit.DAYS,
    )
    interest_type = models.CharField(
        max_length=20,
        choices=InterestType.choices,
        default=InterestType.FLAT,
    )
    interest_rate = models.DecimalField(max_digits=8, decimal_places=4)
    processing_fee_type = models.CharField(
        max_length=20,
        choices=ProcessingFeeType.choices,
        default=ProcessingFeeType.FIXED,
    )
    processing_fee_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    processing_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Flat rupee amount when processing_fee_type is fixed.",
    )
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    penalty_rate = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    penalty_grace_days = models.PositiveIntegerField(default=0)
    preclosure_allowed = models.BooleanField(default=True)
    part_payment_allowed = models.BooleanField(default=True)
    max_part_payments = models.PositiveIntegerField(default=999)
    overdue_after_days = models.PositiveIntegerField(default=1)
    default_after_days = models.PositiveIntegerField(default=30)

    class Meta:
        ordering = ["product_code"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(min_amount__lte=models.F("max_amount")),
                name="product_min_lte_max_amount",
            ),
            models.CheckConstraint(
                check=models.Q(min_tenure__lte=models.F("max_tenure")),
                name="product_min_lte_max_tenure",
            ),
        ]

    def __str__(self):
        return f"{self.product_code} — {self.name}"

    def resolve_pf_percentage(self) -> Decimal:
        """Default PF % from product config (percentage-type products only)."""
        if self.processing_fee_type == ProcessingFeeType.PERCENTAGE:
            return Decimal(str(self.processing_fee_percentage or 0))
        return Decimal("0")

    def compute_processing_fee(self, principal: Decimal) -> Decimal:
        """PF amount in rupees for a given principal."""
        principal = Decimal(str(principal or 0))
        if self.processing_fee_type == ProcessingFeeType.PERCENTAGE:
            pct = self.resolve_pf_percentage()
            return (principal * pct / Decimal("100")).quantize(Decimal("0.01"))
        return Decimal(str(self.processing_fee or 0)).quantize(Decimal("0.01"))

    def resolve_gst_percentage(self) -> Decimal:
        return Decimal(str(self.gst_percentage or 0))
