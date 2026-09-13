from django.db import models

from apps.core.encryption import EncryptedCharField
from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .branch import Branch


class LenderBankAccount(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """Operational bank accounts used for loan disbursements."""

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bank_accounts",
    )
    account_name = models.CharField(max_length=255)
    account_number = EncryptedCharField(max_length=50)
    ifsc_code = models.CharField(max_length=11)
    bank_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["account_name"]

    def __str__(self):
        return f"{self.account_name} ({self.ifsc_code})"
