from django.contrib import admin

from apps.customers.models import (
    Customer,
    CustomerAddress,
    CustomerBankAccount,
    CustomerEmployment,
    CustomerIdentity,
    CustomerReference,
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("customer_code", "first_name", "last_name", "email", "status")
    search_fields = ("customer_code", "first_name", "last_name", "email")


admin.site.register(CustomerIdentity)
admin.site.register(CustomerAddress)
admin.site.register(CustomerEmployment)
admin.site.register(CustomerBankAccount)
admin.site.register(CustomerReference)
