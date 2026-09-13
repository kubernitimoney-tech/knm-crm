from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User, UserRole
from apps.dashboard.models import BranchSanctionTarget, OfficerSanctionTarget
from apps.organization.models import Branch

DEFAULT_OFFICER_TARGETS = {
    "admin@kubernitimoney.com": Decimal("5000000"),
    "production@kubernitimoney.com": Decimal("5000000"),
    "rm1@kubernitimoney.com": Decimal("4500000"),
    "rm2@kubernitimoney.com": Decimal("4000000"),
    "cm1@kubernitimoney.com": Decimal("5000000"),
    "cm2@kubernitimoney.com": Decimal("4500000"),
    "cm3@kubernitimoney.com": Decimal("4500000"),
}

DEFAULT_BRANCH_TARGETS = {
    "Mumbai South": Decimal("8000000"),
    "Delhi North": Decimal("6500000"),
    "Bengaluru East": Decimal("9000000"),
    "Pune Main": Decimal("5000000"),
    "Hyderabad": Decimal("7000000"),
    "Chennai Central": Decimal("6000000"),
}


class Command(BaseCommand):
    help = "Seed monthly sanction targets for dashboard tables"

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()
        year = today.year
        month = today.month
        created_officers = 0
        created_branches = 0

        cm_role = Role.objects.filter(slug="credit-manager").first()
        if cm_role:
            for user_role in UserRole.objects.filter(role=cm_role).select_related("user"):
                user = user_role.user
                target_amount = DEFAULT_OFFICER_TARGETS.get(user.email, Decimal("5000000"))
                _, created = OfficerSanctionTarget.objects.update_or_create(
                    officer=user,
                    period_year=year,
                    period_month=month,
                    defaults={"target_amount": target_amount},
                )
                if created:
                    created_officers += 1

        for user_email, target_amount in DEFAULT_OFFICER_TARGETS.items():
            user = User.objects.filter(email=user_email).first()
            if not user:
                continue
            _, created = OfficerSanctionTarget.objects.update_or_create(
                officer=user,
                period_year=year,
                period_month=month,
                defaults={"target_amount": target_amount},
            )
            if created:
                created_officers += 1

        for branch_name, target_amount in DEFAULT_BRANCH_TARGETS.items():
            branch = Branch.objects.filter(branch_name=branch_name).first()
            if not branch:
                continue
            _, created = BranchSanctionTarget.objects.update_or_create(
                branch=branch,
                period_year=year,
                period_month=month,
                defaults={"target_amount": target_amount},
            )
            if created:
                created_branches += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Dashboard targets seeded for {year}-{month:02d} "
                f"({created_officers} officer, {created_branches} branch records created)."
            )
        )
