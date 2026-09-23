from django.contrib import admin

from apps.dashboard.models import BranchSanctionTarget, OfficerSanctionTarget


@admin.register(OfficerSanctionTarget)
class OfficerSanctionTargetAdmin(admin.ModelAdmin):
    list_display = ("officer", "target_amount", "period_year", "period_month", "created_at")
    list_filter = ("period_year", "period_month")
    search_fields = ("officer__email", "officer__first_name", "officer__last_name")
    ordering = ("-period_year", "-period_month")


@admin.register(BranchSanctionTarget)
class BranchSanctionTargetAdmin(admin.ModelAdmin):
    list_display = ("branch", "target_amount", "period_year", "period_month", "created_at")
    list_filter = ("period_year", "period_month", "branch__state")
    search_fields = ("branch__branch_name", "branch__branch_code")
    ordering = ("-period_year", "-period_month")
