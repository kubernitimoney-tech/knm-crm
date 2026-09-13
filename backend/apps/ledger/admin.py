from django.contrib import admin

from apps.ledger.models import LoanLedgerEntry


@admin.register(LoanLedgerEntry)
class LoanLedgerEntryAdmin(admin.ModelAdmin):
    list_display = (
        "loan",
        "transaction_type",
        "debit_amount",
        "credit_amount",
        "balance_after",
        "transaction_date",
    )
    list_filter = ("transaction_type",)
    readonly_fields = (
        "loan",
        "transaction_date",
        "transaction_type",
        "debit_amount",
        "credit_amount",
        "balance_after",
        "created_at",
    )
