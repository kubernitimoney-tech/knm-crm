from django.contrib import admin

from apps.applications.models import (
    ApplicationDecision,
    ApplicationStatusHistory,
    ApplicationVerification,
    LoanApplication,
    SanctionSalaryBank,
)


@admin.register(LoanApplication)
class LoanApplicationAdmin(admin.ModelAdmin):
    list_display = ("application_number", "customer", "product", "status", "requested_amount")
    list_filter = ("status", "product")
    search_fields = ("application_number", "customer__customer_code")


admin.site.register(ApplicationVerification)
admin.site.register(ApplicationDecision)


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("application", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("application__application_number", "remarks")


@admin.register(SanctionSalaryBank)
class SanctionSalaryBankAdmin(admin.ModelAdmin):
    list_display = ("decision", "bank", "account_number", "created_at")
    search_fields = ("account_number", "bank__name")
