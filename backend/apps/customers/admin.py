from django.contrib import admin

from apps.core.admin_mixins import LeadFirstSearchMixin
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


@admin.register(CustomerIdentity)
class CustomerIdentityAdmin(admin.ModelAdmin):
    list_display = ("customer", "identity_type", "is_primary", "verified_at", "verified_by")
    list_filter = ("identity_type", "is_primary")
    search_fields = ("customer__customer_code", "customer__email", "customer__first_name")


@admin.register(CustomerAddress)
class CustomerAddressAdmin(LeadFirstSearchMixin, admin.ModelAdmin):
    list_display = ("lead", "customer", "address_type", "city", "state", "pincode")
    list_filter = ("address_type", "state")
    search_fields = ("lead__lead_id", "customer__customer_code", "city", "pincode", "line1")
    list_select_related = ("lead", "customer")


@admin.register(CustomerEmployment)
class CustomerEmploymentAdmin(admin.ModelAdmin):
    list_display = ("customer", "employer_name", "designation", "employment_type", "is_current")
    list_filter = ("employment_type", "is_current")
    search_fields = ("customer__customer_code", "employer_name", "designation")


@admin.register(CustomerBankAccount)
class CustomerBankAccountAdmin(admin.ModelAdmin):
    list_display = ("customer", "bank_name", "ifsc_code", "is_primary", "is_verified")
    list_filter = ("is_primary", "is_verified", "is_salary_account")
    search_fields = ("customer__customer_code", "bank_name", "ifsc_code")


@admin.register(CustomerReference)
class CustomerReferenceAdmin(LeadFirstSearchMixin, admin.ModelAdmin):
    list_display = ("lead", "customer", "name", "relation", "mobile_number", "is_verified")
    list_filter = ("relation", "is_verified")
    search_fields = ("lead__lead_id", "customer__customer_code", "name", "mobile_number")
    list_select_related = ("lead", "customer")
