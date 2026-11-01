from django.contrib import admin

from apps.helpdesk.models import Ticket, TicketCategory, TicketEvent


@admin.register(TicketCategory)
class TicketCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "default_priority", "sort_order", "is_active")
    list_filter = ("department", "is_active")
    search_fields = ("name",)


class TicketEventInline(admin.TabularInline):
    model = TicketEvent
    extra = 0
    can_delete = False
    readonly_fields = ("kind", "actor", "from_status", "to_status", "remark", "created_at")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    # Read-only: status changes must go through TicketService so history stays complete.
    list_display = ("ticket_no", "subject", "department", "status", "raised_by", "assigned_to")
    list_filter = ("status", "department", "priority")
    search_fields = ("ticket_no", "subject", "reference_text")
    inlines = [TicketEventInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
