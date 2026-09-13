from django.db import models

from apps.core.encryption import EncryptedCharField, blind_hash
from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .customer import Customer


class CustomerBankAccount(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="bank_accounts",
    )
    account_number = EncryptedCharField(max_length=50)
    account_hash = models.CharField(max_length=64, db_index=True, editable=False)
    ifsc_code = models.CharField(max_length=11)
    bank_name = models.CharField(max_length=255)
    is_salary_account = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["customer", "is_primary"])]
        constraints = [
            models.UniqueConstraint(
                fields=["account_hash"],
                condition=~models.Q(account_hash=""),
                name="unique_customer_bank_account_hash",
            ),
        ]

    def save(self, *args, **kwargs):
        self.account_hash = blind_hash(self.account_number) or ""
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer_id} — {self.bank_name}"
