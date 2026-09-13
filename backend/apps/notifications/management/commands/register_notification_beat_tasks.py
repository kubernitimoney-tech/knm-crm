from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Register Celery Beat periodic tasks for loan repayment and overdue notifications."

    def handle(self, *args, **options):
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        reminder_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="9",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone=settings.TIME_ZONE,
        )
        overdue_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute="5",
            hour="9",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone=settings.TIME_ZONE,
        )
        reminder_task, created = PeriodicTask.objects.update_or_create(
            name="loan-repayment-reminder-notifications",
            defaults={
                "task": "apps.notifications.tasks.send_repayment_reminder_notifications",
                "crontab": reminder_schedule,
                "enabled": True,
            },
        )
        overdue_task, created_overdue = PeriodicTask.objects.update_or_create(
            name="loan-overdue-notifications",
            defaults={
                "task": "apps.notifications.tasks.send_loan_overdue_notifications",
                "crontab": overdue_schedule,
                "enabled": True,
            },
        )
        self.stdout.write(
            self.style.SUCCESS(f"Registered beat tasks: {reminder_task.name}, {overdue_task.name}")
        )
