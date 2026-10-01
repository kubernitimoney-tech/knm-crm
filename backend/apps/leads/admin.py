from django.contrib import admin

from apps.leads.models import (
    CallLog,
    DeletedLead,
    Lead,
    LeadActivity,
    LeadAssignmentHistory,
    LeadEsignRequest,
    LeadFollowUpRemark,
    LeadSource,
    LeadStatusHistory,
    LeadVideoKycRequest,
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


@admin.register(LeadFollowUpRemark)
class LeadFollowUpRemarkAdmin(admin.ModelAdmin):
    list_display = (
        "lead",
        "remark_category",
        "priority",
        "follow_up_date",
        "created_by",
        "created_at",
    )
    list_filter = ("priority", "remark_category")
    search_fields = ("lead__lead_id", "notes")


@admin.register(LeadStatusHistory)
class LeadStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("lead", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("lead__lead_id", "remarks")


@admin.register(LeadEsignRequest)
class LeadEsignRequestAdmin(admin.ModelAdmin):
    list_display = (
        "lead",
        "status",
        "sign_type",
        "recipient_email",
        "requested_by",
        "created_at",
    )
    list_filter = ("status", "sign_type", "provider")
    search_fields = ("lead__lead_id", "recipient_email", "provider_request_id")
    readonly_fields = ("access_token",)


@admin.register(LeadVideoKycRequest)
class LeadVideoKycRequestAdmin(admin.ModelAdmin):
    list_display = (
        "lead",
        "status",
        "session_label",
        "recipient_email",
        "requested_by",
        "created_at",
    )
    list_filter = ("status", "provider")
    search_fields = ("lead__lead_id", "recipient_email", "provider_request_id")
    readonly_fields = ("access_token",)
