import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class UserApprovalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class UserApproval(models.Model):
    """
    Maker-checker approval for a new CRM user, with the approval mail as evidence.

    ``approved_by`` / ``approved_at`` / ``approver_remarks`` record the reviewer's
    decision, whether it was an approval or a rejection. A rejected request can be
    resubmitted, which resets it to pending; earlier decisions stay in the
    user activity log.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="approval",
    )
    attachment = models.FileField(
        upload_to="user_approvals/%Y/%m/",
        blank=True,
        verbose_name="Approval attachment",
        help_text="Approval mail or document (PDF, EML, MSG, PNG, JPG; max 5 MB).",
    )
    attachment_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Original file name",
    )
    request_remarks = models.TextField(verbose_name="Request remarks")
    status = models.CharField(
        max_length=20,
        choices=UserApprovalStatus.choices,
        default=UserApprovalStatus.PENDING,
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_approvals_requested",
        verbose_name="Requested by",
    )
    created_at = models.DateTimeField(default=timezone.now, verbose_name="Requested at")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_approvals_reviewed",
        verbose_name="Reviewed by",
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="Reviewed at")
    approver_remarks = models.TextField(blank=True, verbose_name="Approver remarks")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Approval"
        verbose_name_plural = "User Approvals"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.get_status_display()}"
