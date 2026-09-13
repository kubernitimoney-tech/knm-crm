import uuid

from django.conf import settings
from django.db import models

from apps.accounts.models.permission import Permission


class RoleStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Role name",
        help_text="Human-readable role e.g. Relationship Manager.",
    )
    display_name = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Short label for compact UI e.g. Sr. RM, Sr. CM.",
    )
    slug = models.SlugField(
        max_length=100,
        unique=True,
        help_text="Machine identifier for seeding and integrations.",
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20,
        choices=RoleStatus.choices,
        default=RoleStatus.ACTIVE,
        db_index=True,
        verbose_name="Status",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def get_display_name(self) -> str:
        return (self.display_name or self.name).strip()


class UserRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="roles_assigned",
    )

    class Meta:
        verbose_name = "User Role"
        verbose_name_plural = "User Roles"
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="unique_user_role"),
        ]
        ordering = ["user__email", "role__name"]

    def __str__(self):
        return f"{self.user.email} - {self.role.name}"


class RoleChangeRecord(models.Model):
    """Audit trail for role assignment/revocation with approval evidence."""

    class Action(models.TextChoices):
        ASSIGN = "assign", "Assign"
        REVOKE = "revoke", "Revoke"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_change_records",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="change_records")
    action = models.CharField(max_length=20, choices=Action.choices)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="role_changes_performed",
    )
    approval_email = models.FileField(upload_to="role_approvals/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Role Change Record"
        verbose_name_plural = "Role Change Records"
        ordering = ["-created_at"]


class RolePermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    class Meta:
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="unique_role_permission",
            ),
        ]


class RolePermissionChangeRecord(models.Model):
    """Audit trail for role-level permission grant/revoke with approval evidence."""

    class Action(models.TextChoices):
        GRANT = "grant", "Grant"
        REVOKE = "revoke", "Revoke"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="permission_change_records"
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_change_records",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="role_permission_changes_performed",
    )
    approval_email = models.FileField(upload_to="role_permission_approvals/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Role Permission Change Record"
        verbose_name_plural = "Role Permission Change Records"
        ordering = ["-created_at"]
