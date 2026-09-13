from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel
from apps.organization.models import Branch


class OfficerSanctionTarget(UUIDPrimaryKeyModel, TimeStampedModel):
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sanction_targets",
    )
    target_amount = models.DecimalField(max_digits=14, decimal_places=2)
    period_year = models.PositiveSmallIntegerField()
    period_month = models.PositiveSmallIntegerField()

    class Meta:
        verbose_name = "Officer Sanction Target"
        verbose_name_plural = "Officer Sanction Targets"
        ordering = ["-period_year", "-period_month", "officer__first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["officer", "period_year", "period_month"],
                name="uniq_officer_sanction_target_period",
            ),
            models.CheckConstraint(
                check=models.Q(period_month__gte=1, period_month__lte=12),
                name="officer_sanction_target_valid_month",
            ),
        ]

    def __str__(self):
        return f"{self.officer} — {self.period_year}-{self.period_month:02d}"


class BranchSanctionTarget(UUIDPrimaryKeyModel, TimeStampedModel):
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="sanction_targets",
    )
    target_amount = models.DecimalField(max_digits=14, decimal_places=2)
    period_year = models.PositiveSmallIntegerField()
    period_month = models.PositiveSmallIntegerField()

    class Meta:
        verbose_name = "Branch Sanction Target"
        verbose_name_plural = "Branch Sanction Targets"
        ordering = ["-period_year", "-period_month", "branch__branch_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "period_year", "period_month"],
                name="uniq_branch_sanction_target_period",
            ),
            models.CheckConstraint(
                check=models.Q(period_month__gte=1, period_month__lte=12),
                name="branch_sanction_target_valid_month",
            ),
        ]

    def __str__(self):
        return f"{self.branch.branch_name} — {self.period_year}-{self.period_month:02d}"
