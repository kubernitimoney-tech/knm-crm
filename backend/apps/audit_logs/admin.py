from django.contrib import admin

from apps.audit_logs.models import AuditLog, UserActivityLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "model_name", "object_id", "user", "ip_address", "created_at")
    list_filter = ("action", "model_name", "created_at")
    search_fields = ("action", "model_name", "object_id", "user__email", "ip_address")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "user",
        "action",
        "model_name",
        "object_id",
        "before_data",
        "after_data",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "description", "ip_address", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("description", "user__email", "ip_address")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "user",
        "action",
        "description",
        "ip_address",
        "user_agent",
        "metadata",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
