"""Working-day arithmetic for help desk SLAs: Sundays and bank holidays do not count."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone

SUNDAY = 6


def add_working_days(start: datetime, days: int) -> datetime:
    """
    Return ``start`` moved forward by ``days`` working days, keeping the time of day.

    Resolved Friday 16:00 + 3 → Tuesday 16:00 (Sunday skipped). Holidays come
    from organization.BankHoliday.
    """
    from apps.organization.models import BankHoliday

    current = timezone.localtime(start)
    # Generous look-ahead so long holiday runs are still covered in one query.
    window_end = current.date() + timedelta(days=days * 3 + 30)
    holidays = set(
        BankHoliday.objects.filter(
            holiday_date__gt=current.date(), holiday_date__lte=window_end
        ).values_list("holiday_date", flat=True)
    )

    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() == SUNDAY or current.date() in holidays:
            continue
        remaining -= 1
    return current
