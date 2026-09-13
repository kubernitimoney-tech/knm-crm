from django.contrib import admin

from apps.activities.models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("verb", "description", "actor", "content_type", "object_id", "created_at")
    list_filter = ("verb", "content_type", "created_at")
    search_fields = ("verb", "description", "actor__email", "object_id")
    raw_id_fields = ("actor", "content_type")
    date_hierarchy = "created_at"
