import uuid

from django.conf import settings
from django.db import models


class UserActivityAction(models.TextChoices):
    LOGIN = "login", "Login"
    LOGOUT = "logout", "Logout"
    SESSION_INVALIDATED = "session_invalidated", "Session Invalidated"
    EXPORT = "export", "Export"
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"
    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"
    ASSIGN = "assign", "Assign"
    UPLOAD = "upload", "Upload"
    GRANT = "grant", "Grant"
    REVOKE = "revoke", "Revoke"
    SUBMIT = "submit", "Submit"
    CONVERT = "convert", "Convert"


class UserActivityLog(models.Model):
    """Tracks authentication and key user session events."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
    )
    action = models.CharField(max_length=50, choices=UserActivityAction.choices, db_index=True)
    description = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "user_activity_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]
