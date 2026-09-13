from django.contrib import admin

from apps.products.models import LoanProduct


@admin.register(LoanProduct)
class LoanProductAdmin(admin.ModelAdmin):
    list_display = (
        "product_code",
        "name",
        "min_amount",
        "max_amount",
        "tenure_unit",
        "is_active",
    )
    list_filter = ("is_active", "tenure_unit", "interest_type", "processing_fee_type")
    search_fields = ("product_code", "name")
