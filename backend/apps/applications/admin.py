from django.contrib import admin

from apps.applications.models import ApplicationDecision, ApplicationVerification, LoanApplication


@admin.register(LoanApplication)
class LoanApplicationAdmin(admin.ModelAdmin):
    list_display = ("application_number", "customer", "product", "status", "requested_amount")
    list_filter = ("status", "product")
    search_fields = ("application_number", "customer__customer_code")


admin.site.register(ApplicationVerification)
admin.site.register(ApplicationDecision)
