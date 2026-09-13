from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.data.indian_bank_names import INDIAN_BANK_NAMES
from apps.organization.models import Bank


class Command(BaseCommand):
    help = "Seed master Bank records for all major Indian bank names."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reactivate",
            action="store_true",
            help="Mark seeded banks as active if they already exist.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reactivate = options["reactivate"]
        created = 0
        reactivated = 0

        for name in INDIAN_BANK_NAMES:
            bank, was_created = Bank.objects.get_or_create(
                name=name,
                defaults={"is_active": True},
            )
            if was_created:
                created += 1
                continue
            if reactivate and not bank.is_active:
                bank.is_active = True
                bank.save(update_fields=["is_active", "updated_at"])
                reactivated += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded bank names: "
                f"{created} created, {reactivated} reactivated, "
                f"{len(INDIAN_BANK_NAMES)} names in catalog."
            )
        )
