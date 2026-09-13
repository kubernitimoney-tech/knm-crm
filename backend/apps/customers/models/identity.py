from django.conf import settings
from django.db import models

from apps.core.encryption import EncryptedCharField, blind_hash
from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .customer import Customer


class IdentityType(models.TextChoices):
    MOBILE_NO = "mobile_no", "Mobile No"
    EMAIL = "email", "Email"
    PAN = "pan", "PAN"
    AADHAAR = "aadhaar", "Aadhaar"


class CustomerIdentity(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="identities",
    )
    identity_type = models.CharField(max_length=30, choices=IdentityType.choices)
    identity_number = EncryptedCharField(max_length=50)
    identity_hash = models.CharField(max_length=64, db_index=True, editable=False)
    is_primary = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_identities",
    )

    class Meta:
        verbose_name_plural = "Customer identities"
        constraints = [
            models.UniqueConstraint(
                fields=["identity_type", "identity_hash"],
                name="unique_customer_identity_hash",
            ),
        ]
        indexes = [
            models.Index(fields=["customer", "identity_type"]),
        ]

    def save(self, *args, **kwargs):
        self.identity_hash = blind_hash(self.identity_number) or ""
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer_id} — {self.identity_type}"
