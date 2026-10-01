from django.contrib import admin

from apps.loans.models import (
    Loan,
    LoanDisbursement,
    LoanPenalty,
    LoanSettlement,
    LoanStatusHistory,
    LoanWriteOff,
)


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("loan_account_number", "customer", "status", "principal_amount", "due_date")
    list_filter = ("status", "product")
    search_fields = ("loan_account_number", "customer__customer_code")


admin.site.register(LoanDisbursement)
admin.site.register(LoanPenalty)
admin.site.register(LoanSettlement)
admin.site.register(LoanWriteOff)


@admin.register(LoanStatusHistory)
class LoanStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("loan", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("loan__loan_account_number", "remarks")
