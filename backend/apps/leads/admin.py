from django.contrib import admin

from apps.leads.models import (
    CallLog,
    DeletedLead,
    Lead,
    LeadActivity,
    LeadAssignmentHistory,
    LeadSource,
)


@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("lead_id", "customer", "status", "category", "assigned_rm", "created_at")
    list_filter = ("status", "category")
    search_fields = ("lead_id", "customer__customer_code")


@admin.register(DeletedLead)
class DeletedLeadAdmin(admin.ModelAdmin):
    list_display = (
        "lead_id",
        "customer",
        "status",
        "category",
        "deleted_at",
        "deleted_by",
        "created_at",
    )
    list_filter = ("status", "category", "deleted_at")
    search_fields = ("lead_id", "customer__customer_code", "customer__email")
    ordering = ("-deleted_at", "-created_at")
    readonly_fields = (
        "lead_id",
        "customer",
        "source",
        "interested_product",
        "assigned_rm",
        "assigned_cm",
        "required_amount",
        "loan_purpose",
        "category",
        "status",
        "close_reason",
        "rejection_reason",
        "converted_at",
        "converted_application",
        "submitted_at",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )

    def get_queryset(self, request):
        return (
            DeletedLead.all_objects.filter(is_deleted=True)
            .select_related(
                "customer",
                "assigned_rm",
                "deleted_by",
                "created_by",
            )
            .order_by("-deleted_at", "-created_at")
        )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(LeadAssignmentHistory)
admin.site.register(CallLog)
admin.site.register(LeadActivity)
