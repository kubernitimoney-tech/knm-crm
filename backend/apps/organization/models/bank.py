from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class Bank(UUIDPrimaryKeyModel, TimeStampedModel):
    """Master list of Indian banks for salary account reference on sanction."""

    name = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
