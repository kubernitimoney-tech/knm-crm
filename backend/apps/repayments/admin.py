from django.contrib import admin

from apps.repayments.models import LoanRepayment


@admin.register(LoanRepayment)
class LoanRepaymentAdmin(admin.ModelAdmin):
    list_display = ("loan", "amount", "payment_mode", "payment_date", "status", "utr")
    list_filter = ("payment_mode", "status")
