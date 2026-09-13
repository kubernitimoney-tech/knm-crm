from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel
from apps.core.verification import EntryVerificationStatus, is_verified_status

from .customer import Customer


class AddressType(models.TextChoices):
    OWN = "own", "Own"
    RENTED = "rented", "Rented"


class CustomerAddress(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="addresses",
        null=True,
        blank=True,
    )
    address_type = models.CharField(max_length=20, choices=AddressType.choices)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=100, default="India")
    is_verified = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=20,
        choices=EntryVerificationStatus.choices,
        default=EntryVerificationStatus.UNVERIFIED,
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Customer addresses"
        indexes = [models.Index(fields=["customer", "address_type"])]

    def __str__(self):
        return f"{self.customer_id} — {self.address_type}"

    def save(self, *args, **kwargs):
        self.is_verified = is_verified_status(self.verification_status)
        super().save(*args, **kwargs)
