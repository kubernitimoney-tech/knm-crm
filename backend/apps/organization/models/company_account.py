from django.db import models

from apps.core.encryption import EncryptedCharField
from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .branch import Branch


class CompanyAccount(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """Loan company bank accounts maintained by accounts/finance for disbursal."""

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="company_accounts",
    )
    account_name = models.CharField(max_length=255)
    account_number = EncryptedCharField(max_length=50)
    ifsc_code = models.CharField(max_length=11)
    bank_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Default account pre-filled on disbursal sheets.",
    )

    class Meta:
        ordering = ["account_name"]
        indexes = [models.Index(fields=["is_active", "is_default"])]

    def __str__(self):
        return f"{self.account_name} ({self.ifsc_code})"
