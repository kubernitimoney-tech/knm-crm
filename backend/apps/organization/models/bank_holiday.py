from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel


class BankHoliday(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """RBI bank holiday calendar entry scoped to an Indian financial year (Apr–Mar)."""

    holiday_date = models.DateField(db_index=True)
    holiday_name = models.CharField(max_length=255)
    financial_year_start = models.PositiveSmallIntegerField(
        db_index=True,
        help_text="Calendar year when the financial year begins (e.g. 2025 for FY 2025-26).",
    )

    class Meta:
        verbose_name = "Bank Holiday"
        verbose_name_plural = "Bank Holidays"
        ordering = ["-financial_year_start", "holiday_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["financial_year_start", "holiday_date"],
                name="uniq_bank_holiday_fy_date",
            ),
        ]

    def __str__(self):
        return f"{self.holiday_date} — {self.holiday_name}"
