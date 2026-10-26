from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class FieldInvestigator(UUIDPrimaryKeyModel, TimeStampedModel):
    """Master list of field investigators shown in the disbursal sheet "FI Done By" dropdown."""

    name = models.CharField(max_length=255, unique=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
