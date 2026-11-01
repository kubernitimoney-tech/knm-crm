from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Register the Celery Beat task that auto-closes unconfirmed resolved tickets."

    def handle(self, *args, **options):
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        hourly, _ = CrontabSchedule.objects.get_or_create(
            minute="15",
            hour="*",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone=settings.TIME_ZONE,
        )
        task, _ = PeriodicTask.objects.update_or_create(
            name="helpdesk-auto-close-resolved-tickets",
            defaults={
                "task": "apps.helpdesk.tasks.auto_close_resolved_tickets",
                "crontab": hourly,
                "enabled": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Registered beat task: {task.name}"))
