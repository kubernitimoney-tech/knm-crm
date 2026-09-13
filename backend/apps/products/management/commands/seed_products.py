from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.products.models import InterestType, LoanProduct, ProcessingFeeType, TenureUnit
from apps.products.services.workflow_resolver import resolve_default_workflow


class Command(BaseCommand):
    help = "Seed loan product master records"

    @transaction.atomic
    def handle(self, *args, **options):
        resolve_default_workflow()

        products = [
            {
                "product_code": "PAYDAY",
                "name": "Payday Loan",
                "description": "Short-term payday loan product.",
                "min_amount": Decimal("5000"),
                "max_amount": Decimal("100000"),
                "min_tenure": 7,
                "max_tenure": 40,
                "tenure_unit": TenureUnit.DAYS,
                "interest_type": InterestType.FLAT,
                "interest_rate": Decimal("1.00"),
                "penalty_rate": Decimal("0.25"),
                "processing_fee_type": ProcessingFeeType.PERCENTAGE,
                "processing_fee_percentage": Decimal("10"),
                "gst_percentage": Decimal("18"),
                "overdue_after_days": 1,
                "default_after_days": 30,
            },
            {
                "product_code": "SALARY_ADVANCE",
                "name": "Salary Advance",
                "description": "Salary advance loan product.",
                "min_amount": Decimal("10000"),
                "max_amount": Decimal("200000"),
                "min_tenure": 15,
                "max_tenure": 60,
                "tenure_unit": TenureUnit.DAYS,
                "interest_type": InterestType.FLAT,
                "interest_rate": Decimal("2.5000"),
                "processing_fee_type": ProcessingFeeType.FIXED,
                "processing_fee": Decimal("750"),
                "gst_percentage": Decimal("18"),
                "overdue_after_days": 1,
                "default_after_days": 30,
            },
        ]

        created = 0
        for data in products:
            _, was_created = LoanProduct.objects.update_or_create(
                product_code=data["product_code"],
                defaults={**data, "is_active": True},
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Loan products seeded ({created} new)."))
