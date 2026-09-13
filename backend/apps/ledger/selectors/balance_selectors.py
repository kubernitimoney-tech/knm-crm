from decimal import Decimal

from apps.ledger.models import LoanLedgerEntry
from apps.ledger.services.ledger_posting_service import LedgerPostingService


def get_latest_balance(loan_id) -> Decimal:
    return LedgerPostingService.get_balance(loan_id)


def get_ledger_statement(loan_id):
    return LoanLedgerEntry.objects.filter(loan_id=loan_id).order_by("created_at", "id")
