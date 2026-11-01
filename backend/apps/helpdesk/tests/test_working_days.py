from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.test import TestCase

from apps.helpdesk.services.working_days import add_working_days
from apps.organization.models import BankHoliday

IST = ZoneInfo("Asia/Kolkata")


class AddWorkingDaysTests(TestCase):
    def test_skips_sunday_and_keeps_time_of_day(self):
        friday = datetime(2026, 11, 6, 16, 0, tzinfo=IST)
        result = add_working_days(friday, 3)
        self.assertEqual(result, datetime(2026, 11, 10, 16, 0, tzinfo=IST))  # Tuesday

    def test_resolved_on_saturday(self):
        saturday = datetime(2026, 11, 7, 10, 30, tzinfo=IST)
        result = add_working_days(saturday, 3)
        self.assertEqual(result, datetime(2026, 11, 11, 10, 30, tzinfo=IST))  # Wednesday

    def test_resolved_on_sunday(self):
        sunday = datetime(2026, 11, 8, 9, 0, tzinfo=IST)
        result = add_working_days(sunday, 3)
        self.assertEqual(result, datetime(2026, 11, 11, 9, 0, tzinfo=IST))  # Wednesday

    def test_skips_bank_holidays(self):
        BankHoliday.objects.create(
            holiday_date=date(2026, 11, 9),
            holiday_name="Test holiday",
            financial_year_start=2026,
        )
        friday = datetime(2026, 11, 6, 16, 0, tzinfo=IST)
        # Sat counts, Sun skipped, Mon holiday skipped, Tue, Wed.
        result = add_working_days(friday, 3)
        self.assertEqual(result, datetime(2026, 11, 11, 16, 0, tzinfo=IST))
