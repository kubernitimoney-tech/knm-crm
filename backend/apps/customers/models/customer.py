from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class Gender(models.TextChoices):
    MALE = "male", "Male"
    FEMALE = "female", "Female"
    OTHER = "other", "Other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say", "Prefer not to say"


class CustomerStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    BLACKLISTED = "blacklisted", "Blacklisted"


class Customer(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel, SoftDeleteModel):
    """Party master — source of truth for borrower identity and profile."""

    customer_code = models.CharField(max_length=20, unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(db_index=True)
    mobile_number = models.CharField(max_length=20, db_index=True)
    gender = models.CharField(max_length=30, choices=Gender.choices, blank=True)
    dob = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=CustomerStatus.choices,
        default=CustomerStatus.ACTIVE,
        db_index=True,
    )

    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        indexes = [
            models.Index(fields=["customer_code"]),
            models.Index(fields=["email", "is_deleted"]),
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self):
        return f"{self.customer_code} - {self.first_name} {self.last_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
