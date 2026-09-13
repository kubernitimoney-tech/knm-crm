from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User, UserRole

# Aligned with the accounts_user table (kubernitimoney tenant).
SEED_USERS = [
    {
        "email": "pankaj@kubernitimoney.com",
        "first_name": "Pankaj",
        "last_name": "",
        "role_slug": "super-admin",
        "is_staff": True,
        "is_superuser": True,
        "is_verified": True,
        "default_password": "Admin@123",
    },
    {
        "email": "admin@kubernitimoney.com",
        "first_name": "Admin",
        "last_name": "",
        "role_slug": "admin",
        "is_staff": True,
        "is_superuser": False,
        "is_verified": True,
        "default_password": "Admin@123",
    },
    {
        "email": "production@kubernitimoney.com",
        "first_name": "Production",
        "last_name": "Manager",
        "role_slug": "production-manager",
        "is_verified": True,
        "default_password": "Admin@123",
    },
    {
        "email": "account@kubernitimoney.com",
        "first_name": "Account",
        "last_name": "",
        "role_slug": "account-finance",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "collection@kubernitimoney.com",
        "first_name": "Collection",
        "last_name": "",
        "role_slug": "collection-officer",
        "is_verified": False,
        "default_password": "DeDust!23",
    },
    {
        "email": "cm1@kubernitimoney.com",
        "first_name": "Sr.",
        "last_name": "CM",
        "role_slug": "senior-credit-manager",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "cm2@kubernitimoney.com",
        "first_name": "CM",
        "last_name": "2",
        "role_slug": "credit-manager",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "cm3@kubernitimoney.com",
        "first_name": "CM",
        "last_name": "3",
        "role_slug": "credit-manager",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "fi1@kubernitimoney.com",
        "first_name": "FI",
        "last_name": "1",
        "role_slug": "field-investigator",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "fi2@kubernitimoney.com",
        "first_name": "FI",
        "last_name": "2",
        "role_slug": "field-investigator",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "rm1@kubernitimoney.com",
        "first_name": "Sr. RM",
        "last_name": "1",
        "role_slug": "senior-relationship-manager",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
    {
        "email": "rm2@kubernitimoney.com",
        "first_name": "Rm",
        "last_name": "2",
        "role_slug": "relationship-manager",
        "is_verified": True,
        "default_password": "DeDust!23",
    },
]

ADMIN_EMAIL = "admin@kubernitimoney.com"

SAMPLE_CUSTOMER_EMAILS = (
    "rahul@example.com",
    "priya@example.com",
    "aman.verma@example.com",
)


class Command(BaseCommand):
    help = "Seed tenant users, RBAC roles, and reference master data"

    def _upsert_user(self, entry: dict) -> User:
        defaults = {
            "first_name": entry["first_name"],
            "last_name": entry.get("last_name", ""),
            "is_staff": entry.get("is_staff", False),
            "is_superuser": entry.get("is_superuser", False),
            "is_verified": entry.get("is_verified", True),
            "is_active": entry.get("is_active", True),
        }
        user, created = User.objects.get_or_create(email=entry["email"], defaults=defaults)
        if not created:
            changed = False
            for field, value in defaults.items():
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    changed = True
            if changed:
                user.save()

        if not user.has_usable_password():
            user.set_password(entry.get("default_password", "DeDust!23"))
            user.save(update_fields=["password"])

        return user

    def _assign_role(self, user: User, role_slug: str, *, assigned_by: User) -> None:
        role = Role.objects.filter(slug=role_slug, is_active=True).first()
        if not role:
            self.stdout.write(self.style.WARNING(f"Role not found: {role_slug}"))
            return
        UserRole.objects.filter(user=user).exclude(role=role).delete()
        UserRole.objects.get_or_create(user=user, role=role, defaults={"assigned_by": assigned_by})

    @transaction.atomic
    def _purge_sample_transaction_data(self) -> int:
        from apps.applications.models import LoanApplication
        from apps.customers.models import Customer
        from apps.leads.models import Lead
        from apps.ledger.models import LoanLedgerEntry
        from apps.loans.models import Loan, LoanDisbursement
        from apps.repayments.models import LoanRepayment

        customers = Customer.all_objects.filter(email__in=SAMPLE_CUSTOMER_EMAILS)
        if not customers.exists():
            return 0

        loans = Loan.all_objects.filter(customer__in=customers)
        loan_ids = list(loans.values_list("id", flat=True))
        application_ids = list(
            LoanApplication.all_objects.filter(customer__in=customers).values_list("id", flat=True)
        )

        repayments_deleted, _ = LoanRepayment.objects.filter(loan_id__in=loan_ids).delete()
        disbursements_deleted, _ = LoanDisbursement.objects.filter(loan_id__in=loan_ids).delete()
        ledger_deleted, _ = LoanLedgerEntry.objects.filter(loan_id__in=loan_ids).delete()
        loans_deleted, _ = loans.hard_delete()
        Lead.all_objects.filter(customer__in=customers).update(converted_application=None)
        applications_deleted, _ = LoanApplication.all_objects.filter(
            id__in=application_ids
        ).hard_delete()
        leads_deleted, _ = Lead.all_objects.filter(customer__in=customers).hard_delete()
        customers_deleted, _ = customers.hard_delete()

        return (
            repayments_deleted
            + disbursements_deleted
            + ledger_deleted
            + loans_deleted
            + applications_deleted
            + leads_deleted
            + customers_deleted
        )

    def handle(self, *args, **options):
        removed = self._purge_sample_transaction_data()
        if removed:
            self.stdout.write(
                self.style.WARNING(f"Removed {removed} sample transaction record(s).")
            )

        call_command("seed_permissions")
        call_command("seed_loan_workflow")
        call_command("seed_document_types")
        call_command("seed_branches")
        call_command("seed_bank_names")
        call_command("seed_products")
        call_command("seed_dashboard_targets")

        users_by_email: dict[str, User] = {}
        for entry in SEED_USERS:
            user = self._upsert_user(entry)
            users_by_email[user.email] = user

        admin = users_by_email.get(ADMIN_EMAIL)
        if not admin:
            self.stdout.write(self.style.ERROR(f"Admin user missing: {ADMIN_EMAIL}"))
            return

        for entry in SEED_USERS:
            user = users_by_email[entry["email"]]
            self._assign_role(user, entry["role_slug"], assigned_by=admin)
            self.stdout.write(f"User configured: {user.email} ({entry['role_slug']})")

        self.stdout.write(self.style.SUCCESS("Sample data seeded."))
