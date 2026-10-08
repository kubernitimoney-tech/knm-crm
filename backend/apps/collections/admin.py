from django.contrib import admin

from apps.collections.models import (
    CollectionActivity,
    CollectionCase,
    PromiseToPay,
    SettlementOffer,
)


@admin.register(CollectionCase)
class CollectionCaseAdmin(admin.ModelAdmin):
    list_display = ("loan", "bucket", "dpd", "status", "assigned_collector", "opened_at")
    list_filter = ("status", "bucket")
    search_fields = ("loan__loan_account_number",)


@admin.register(CollectionActivity)
class CollectionActivityAdmin(admin.ModelAdmin):
    list_display = ("case", "activity_type", "outcome", "performed_by", "performed_at")
    list_filter = ("activity_type",)
    search_fields = ("case__loan__loan_account_number", "outcome", "notes")


@admin.register(PromiseToPay)
class PromiseToPayAdmin(admin.ModelAdmin):
    list_display = ("case", "promised_amount", "promised_date", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("case__loan__loan_account_number",)


@admin.register(SettlementOffer)
class SettlementOfferAdmin(admin.ModelAdmin):
    list_display = ("case", "offered_amount", "valid_until", "status", "approved_by")
    list_filter = ("status",)
    search_fields = ("case__loan__loan_account_number",)
