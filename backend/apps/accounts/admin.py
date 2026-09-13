from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import (
    Permission,
    PermissionChangeRecord,
    Role,
    RoleChangeRecord,
    RolePermission,
    RolePermissionChangeRecord,
    User,
    UserPermission,
    UserRole,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "employee_code",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "is_verified",
        "last_login",
    )
    list_filter = ("is_active", "is_staff", "is_verified", "is_superuser")
    search_fields = ("employee_code", "email", "first_name", "last_name", "mobile_number")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "mobile_number")}),
        ("Status", {"fields": ("is_active", "is_staff", "is_verified", "is_superuser")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "display_name", "slug", "status", "is_active", "created_at")
    list_filter = ("status", "is_active")
    search_fields = ("name", "display_name", "slug", "description")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "module", "action", "status", "created_at")
    list_filter = ("status", "module", "action")
    search_fields = ("code", "module", "action", "description")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "assigned_at", "assigned_by")
    list_filter = ("role", "assigned_at")
    search_fields = ("user__email", "role__name", "role__slug")
    raw_id_fields = ("user", "assigned_by")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission")
    list_filter = ("role",)
    search_fields = ("role__name", "role__slug", "permission__code")


@admin.register(RoleChangeRecord)
class RoleChangeRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "action", "performed_by", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("user__email", "role__name", "performed_by__email")
    raw_id_fields = ("user", "performed_by")


@admin.register(RolePermissionChangeRecord)
class RolePermissionChangeRecordAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "action", "performed_by", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("role__name", "role__slug", "permission__code", "performed_by__email")
    raw_id_fields = ("role", "permission", "performed_by")
    date_hierarchy = "created_at"


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "is_active", "granted_by", "granted_at")
    list_filter = ("is_active", "granted_at")
    search_fields = ("user__email", "permission__code", "granted_by__email")
    raw_id_fields = ("user", "granted_by")


@admin.register(PermissionChangeRecord)
class PermissionChangeRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "action", "performed_by", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("user__email", "permission__code", "performed_by__email")
    raw_id_fields = ("user", "performed_by")
