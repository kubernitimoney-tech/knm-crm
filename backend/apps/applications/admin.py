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


@admin.register(ApplicationVerification)
class ApplicationVerificationAdmin(admin.ModelAdmin):
    list_display = ("application", "verification_type", "status", "verified_by", "verified_at")
    list_filter = ("verification_type", "status")
    search_fields = ("application__application_number", "notes")


@admin.register(ApplicationDecision)
class ApplicationDecisionAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "decision",
        "approved_amount",
        "approved_tenure_value",
        "interest_rate",
        "processing_fee",
        "decided_by",
        "decided_at",
        "rejection_reason",
        "remarks",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    list_filter = ("decision", "decided_at")
    search_fields = (
        "application__application_number",
        "application__lead__lead_id",
        "rejection_reason",
        "remarks",
    )
    list_select_related = (
        "application",
        "application__lead",
        "decided_by",
        "created_by",
        "updated_by",
    )
    exclude = ("sanction_details",)
    readonly_fields = ("id", "decided_at", "created_at", "updated_at")
    ordering = ("-decided_at",)


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("application", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("application__application_number", "remarks")


@admin.register(SanctionSalaryBank)
class SanctionSalaryBankAdmin(admin.ModelAdmin):
    list_display = ("decision", "bank", "account_number", "created_at")
    search_fields = ("account_number", "bank__name")
