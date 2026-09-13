from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .customer import Customer


class ReferenceRelation(models.TextChoices):
    FATHER = "father", "Father"
    MOTHER = "mother", "Mother"
    BROTHER = "brother", "Brother"
    SISTER = "sister", "Sister"
    SPOUSE = "spouse", "Spouse"
    FRIEND = "friend", "Friend"
    COLLEAGUE = "colleague", "Colleague"
    OTHER = "other", "Other"


class CustomerReference(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="references",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="references",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    mobile_number = models.CharField(max_length=20)
    relation = models.CharField(max_length=30, choices=ReferenceRelation.choices)
    is_verified = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["customer"])]

    def __str__(self):
        return f"{self.customer_id} — {self.name}"
