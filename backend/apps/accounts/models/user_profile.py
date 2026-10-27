import uuid

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """Contact and placement details for a CRM user (one per user)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    mobile_number = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        verbose_name="Mobile number",
        help_text="10-digit Indian mobile. Required for new users.",
    )
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="user_profiles",
        verbose_name="Branch",
    )
    address = models.TextField(blank=True, verbose_name="Address")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"Profile of {self.user}"
