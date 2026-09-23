from django.contrib import admin

from apps.loans.models import Loan, LoanDisbursement, LoanPenalty, LoanSettlement, LoanWriteOff


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("loan_account_number", "customer", "status", "principal_amount", "due_date")
    list_filter = ("status", "product")
    search_fields = ("loan_account_number", "customer__customer_code")


admin.site.register(LoanDisbursement)
admin.site.register(LoanPenalty)
admin.site.register(LoanSettlement)
admin.site.register(LoanWriteOff)
