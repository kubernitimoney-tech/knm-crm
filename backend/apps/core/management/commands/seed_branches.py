import re

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.organization.models import Branch, BranchStatus

DEFAULT_BRANCHES = [
    "Mumbai South",
    "Delhi North",
    "Bengaluru East",
    "Pune Main",
    "Hyderabad",
    "Chennai Central",
    "Kolkata",
    "Ahmedabad",
]


def _branch_code(name: str) -> str:
    slug = re.sub(r"[^A-Z0-9]", "", name.upper())[:15]
    return slug or "BRANCH"


class Command(BaseCommand):
    help = "Seed default branch master records"

    @transaction.atomic
    def handle(self, *args, **options):
        used_codes = set(Branch.objects.values_list("branch_code", flat=True))
        created = 0

        for index, branch_name in enumerate(DEFAULT_BRANCHES, start=1):
            if Branch.objects.filter(branch_name=branch_name).exists():
                continue

            code = _branch_code(branch_name)
            while code in used_codes:
                code = f"{_branch_code(branch_name)[:17]}{index:02d}"
                index += 1
            used_codes.add(code)

            Branch.objects.create(
                branch_code=code,
                branch_name=branch_name,
                bank_name="LMS Bank",
                address_line1="Head Office",
                city=branch_name.split()[0],
                state="Maharashtra",
                country="India",
                mobile_no="9000000000",
                status=BranchStatus.ACTIVE,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Branch master seeded ({created} created)."))
