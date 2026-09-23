from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.customers.services.customer_service import CustomerService
from apps.leads.models import Lead, LeadCategory, LeadSource
from apps.leads.services.lead_service import LeadService
from apps.products.models import LoanProduct

User = get_user_model()


def _actor_user():
    user = User.objects.filter(is_superuser=True, is_active=True).order_by("created_at").first()
    if user:
        return user
    user = User.objects.filter(is_active=True).order_by("created_at").first()
    if user:
        return user
    raise CommandError("No active user found. Create an admin user before seeding leads.")


def _unique_pan(seq: int) -> str:
    return f"TSFL{seq:04d}A"


def _unique_mobile(seq: int) -> str:
    # 10-digit Indian mobile starting with 9
    return f"9{seq:09d}"[-10:]


class Command(BaseCommand):
    help = "Seed fresh CRM leads (unique customers, category=fresh) for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=100,
            help="Number of fresh leads to create (default: 100)",
        )
        parser.add_argument(
            "--prefix",
            type=str,
            default="TEST",
            help="Prefix for generated lead customer first names",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        count = options["count"]
        prefix = options["prefix"].strip() or "TEST"

        if count < 1:
            raise CommandError("--count must be at least 1")

        actor = _actor_user()
        source, _ = LeadSource.objects.get_or_create(
            slug="website",
            defaults={"name": "Website", "is_active": True},
        )
        product = LoanProduct.objects.filter(product_code="PAYDAY", is_active=True).first()
        if product is None:
            raise CommandError("PAYDAY product not found. Run: python manage.py seed_products")

        start_seq = Lead.objects.count() + 1
        created = 0
        skipped = 0

        for offset in range(count):
            seq = start_seq + offset
            pan = _unique_pan(seq)
            mobile = _unique_mobile(900000000 + seq)

            if CustomerService.find_by_pan(pan):
                skipped += 1
                continue

            customer = CustomerService.create_customer(
                user=actor,
                data={
                    "first_name": prefix,
                    "last_name": f"Lead{seq:04d}",
                    "email": f"fresh.lead.{seq}@test.lms.local",
                    "mobile_number": mobile,
                    "pan_no": pan,
                },
                employment={
                    "employment_type": "salaried",
                    "monthly_salary": Decimal("45000") + (offset % 20) * 2500,
                },
                address={
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560001",
                    "line1": f"{100 + offset} MG Road",
                },
            )

            lead = LeadService.create_lead(
                user=actor,
                customer=customer,
                data={
                    "source": source,
                    "interested_product": product,
                    "required_amount": Decimal("25000") + (offset % 10) * 5000,
                    "loan_purpose": "Personal",
                },
            )

            if lead.category != LeadCategory.FRESH:
                raise CommandError(
                    f"Expected fresh lead but got category={lead.category} for {lead.lead_id}"
                )

            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created} fresh leads (skipped {skipped} duplicates). "
                f"Latest lead IDs end around sequence {start_seq + created - 1}."
            )
        )
