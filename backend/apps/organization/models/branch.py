"""Lender branch master — used by applications, disbursements, and targets."""

from django.db import models

from apps.core.models.base import TimeStampedModel, UUIDPrimaryKeyModel


class BranchStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Branch(UUIDPrimaryKeyModel, TimeStampedModel):
    branch_code = models.CharField(max_length=20, unique=True, db_index=True)
    branch_name = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=255)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default="India")
    mobile_no = models.CharField(max_length=20)
    phone_no = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    opening_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=BranchStatus.choices,
        default=BranchStatus.ACTIVE,
        db_index=True,
    )

    class Meta:
        verbose_name = "Branch"
        verbose_name_plural = "Branches"
        ordering = ["branch_name"]
        indexes = [
            models.Index(fields=["branch_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["state", "city"]),
        ]

    def __str__(self):
        return f"{self.branch_code} - {self.branch_name}"
