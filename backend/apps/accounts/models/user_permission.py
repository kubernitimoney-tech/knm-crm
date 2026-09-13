import uuid

from django.conf import settings
from django.db import models

from apps.accounts.models.permission import Permission


class UserPermission(models.Model):
    """Direct permission grant to a user (beyond role-based permissions)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="direct_permissions",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="user_grants",
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="permissions_granted",
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "User Permission"
        verbose_name_plural = "User Permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "permission"],
                name="unique_user_permission",
            ),
        ]


class PermissionChangeRecord(models.Model):
    """Audit trail for grant/revoke with approval email evidence."""

    class Action(models.TextChoices):
        GRANT = "grant", "Grant"
        REVOKE = "revoke", "Revoke"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permission_change_records",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="change_records",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="permission_changes_performed",
    )
    approval_email = models.FileField(upload_to="permission_approvals/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Permission Change Record"
        verbose_name_plural = "Permission Change Records"
        ordering = ["-created_at"]
