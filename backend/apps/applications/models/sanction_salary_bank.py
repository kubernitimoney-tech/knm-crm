from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class SanctionSalaryBank(UUIDPrimaryKeyModel, TimeStampedModel):
    """Many-to-many link: one sanction decision can reference multiple salary banks."""

    decision = models.ForeignKey(
        "applications.ApplicationDecision",
        on_delete=models.CASCADE,
        related_name="salary_bank_links",
    )
    bank = models.ForeignKey(
        "organization.Bank",
        on_delete=models.PROTECT,
        related_name="sanction_salary_links",
    )
    account_number = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["decision", "bank"],
                name="uniq_sanction_salary_bank_per_decision",
            )
        ]

    def __str__(self) -> str:
        return f"{self.decision_id} — {self.bank.name}"
