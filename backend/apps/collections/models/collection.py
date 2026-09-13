from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel


class CollectionBucket(models.TextChoices):
    CURRENT = "current", "Current"
    DAYS_1_30 = "1_30", "1-30 DPD"
    DAYS_31_60 = "31_60", "31-60 DPD"
    DAYS_61_90 = "61_90", "61-90 DPD"
    DAYS_90_PLUS = "90_plus", "90+ DPD"


class CollectionCaseStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"
    RESOLVED = "resolved", "Resolved"


class CollectionActivityType(models.TextChoices):
    CALL = "call", "Call"
    VISIT = "visit", "Visit"
    SMS = "sms", "SMS"
    EMAIL = "email", "Email"


class PromiseToPayStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    KEPT = "kept", "Kept"
    BROKEN = "broken", "Broken"


class SettlementOfferStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    EXPIRED = "expired", "Expired"


class CollectionCase(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    loan = models.OneToOneField(
        "loans.Loan",
        on_delete=models.CASCADE,
        related_name="collection_case",
    )
    assigned_collector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collection_cases",
    )
    bucket = models.CharField(
        max_length=10,
        choices=CollectionBucket.choices,
        default=CollectionBucket.CURRENT,
        db_index=True,
    )
    dpd = models.PositiveIntegerField(default=0)
    outstanding_at_assignment = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=CollectionCaseStatus.choices,
        default=CollectionCaseStatus.OPEN,
        db_index=True,
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["bucket", "status"]),
            models.Index(fields=["assigned_collector", "status"]),
        ]


class CollectionActivity(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    case = models.ForeignKey(
        CollectionCase,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    activity_type = models.CharField(max_length=20, choices=CollectionActivityType.choices)
    outcome = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    next_follow_up = models.DateTimeField(null=True, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    performed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Collection activities"
        ordering = ["-performed_at"]


class PromiseToPay(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    case = models.ForeignKey(
        CollectionCase,
        on_delete=models.CASCADE,
        related_name="promises_to_pay",
    )
    promised_amount = models.DecimalField(max_digits=14, decimal_places=2)
    promised_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=PromiseToPayStatus.choices,
        default=PromiseToPayStatus.PENDING,
    )

    class Meta:
        ordering = ["-promised_date"]


class SettlementOffer(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    case = models.ForeignKey(
        CollectionCase,
        on_delete=models.CASCADE,
        related_name="settlement_offers",
    )
    offered_amount = models.DecimalField(max_digits=14, decimal_places=2)
    valid_until = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=SettlementOfferStatus.choices,
        default=SettlementOfferStatus.PENDING,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_settlement_offers",
    )

    class Meta:
        ordering = ["-created_at"]
