from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "channel", "is_read", "created_at")
    list_filter = ("channel", "is_read", "created_at")
    search_fields = ("title", "body", "recipient__email")
    raw_id_fields = ("recipient",)
    date_hierarchy = "created_at"
