from django.core.management.base import BaseCommand, CommandError

from apps.integrations.cashfree.orders import CashfreeOrderError
from apps.repayments.services.online_repayment_service import record_verified_order


class Command(BaseCommand):
    help = (
        "Record repayment-page Cashfree orders (rp-...) that were paid but never "
        "reached the collection table. Safe to re-run: one row per order."
    )

    def add_arguments(self, parser):
        parser.add_argument("order_ids", nargs="+", help="Cashfree order ids, e.g. rp-...")

    def handle(self, *args, order_ids, **options):
        failed = False
        for order_id in order_ids:
            try:
                repayment = record_verified_order(order_id)
            except CashfreeOrderError as exc:
                failed = True
                self.stderr.write(f"{order_id}: {exc}")
                continue
            if repayment is None:
                failed = True
                self.stderr.write(
                    f"{order_id}: not recorded (not an rp- order, unpaid, or the loan is closed)"
                )
                continue
            self.stdout.write(
                f"{order_id}: {repayment.get_status_display()} collection "
                f"{repayment.amount} on loan {repayment.loan_id}"
            )
        if failed:
            raise CommandError("Some orders were not recorded.")
