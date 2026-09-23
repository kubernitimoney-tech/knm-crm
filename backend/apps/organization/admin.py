from django.contrib import admin

from apps.organization.models import Bank, BankHoliday, Branch, CompanyAccount, LenderBankAccount


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("is_active",)


@admin.register(BankHoliday)
class BankHolidayAdmin(admin.ModelAdmin):
    list_display = ("holiday_date", "holiday_name", "financial_year_start", "created_at")
    search_fields = ("holiday_name",)
    list_filter = ("financial_year_start",)
    ordering = ("-financial_year_start", "holiday_date")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("branch_code", "branch_name", "city", "state", "status")
    search_fields = ("branch_code", "branch_name", "city")
    list_filter = ("status", "state")


@admin.register(LenderBankAccount)
class LenderBankAccountAdmin(admin.ModelAdmin):
    list_display = ("account_name", "ifsc_code", "bank_name", "branch", "is_active")
    list_filter = ("is_active",)


@admin.register(CompanyAccount)
class CompanyAccountAdmin(admin.ModelAdmin):
    list_display = ("account_name", "ifsc_code", "bank_name", "branch", "is_active", "is_default")
    list_filter = ("is_active", "is_default")
