from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .customer import Customer


class EmploymentType(models.TextChoices):
    SALARIED = "salaried", "Salaried"
    SELF_EMPLOYED = "self_employed", "Self Employed"


class CustomerEmployment(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="employments",
    )
    employer_name = models.CharField(max_length=255)
    designation = models.CharField(max_length=100, blank=True)
    employment_type = models.CharField(max_length=30, choices=EmploymentType.choices)
    monthly_salary = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    experience_months = models.PositiveIntegerField(default=0)
    is_current = models.BooleanField(default=True, db_index=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Customer employments"
        indexes = [models.Index(fields=["customer", "is_current"])]

    def __str__(self):
        return f"{self.customer_id} — {self.employer_name}"
