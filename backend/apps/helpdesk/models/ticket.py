from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel


class TicketDepartment(models.TextChoices):
    RELATIONSHIP = "relationship", "Relationship (RM)"
    CREDIT = "credit", "Credit (CM)"
    COLLECTION = "collection", "Collection"
    ACCOUNTS = "accounts", "Accounts & Finance"
    GENERAL = "general", "General"


class TicketPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class TicketStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In Progress"
    ON_HOLD = "on_hold", "On Hold"
    RESOLVED = "resolved", "Resolved"
    REOPENED = "reopened", "Reopened"
    CLOSED = "closed", "Closed"
    CANCELLED = "cancelled", "Cancelled"


class TicketCloseType(models.TextChoices):
    CONFIRMED = "confirmed", "Confirmed by raiser"
    AUTO = "auto", "Auto-closed"


class TicketCategory(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """Admin-managed issue type (e.g. "Repayment date change") under a department."""

    department = models.CharField(max_length=20, choices=TicketDepartment.choices, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    default_priority = models.CharField(
        max_length=10, choices=TicketPriority.choices, default=TicketPriority.MEDIUM
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = "Ticket Category"
        verbose_name_plural = "Ticket Categories"
        ordering = ["department", "sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "name"], name="uniq_ticket_category_dept_name"
            ),
        ]

    def __str__(self):
        return f"{self.get_department_display()} — {self.name}"


class Ticket(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """
    Help desk ticket raised by an internal user and worked by IT Support.

    Only the raiser may close (confirm) a resolved ticket or reopen it;
    unconfirmed resolutions auto-close after 3 working days (see auto_close_at).
    """

    ticket_no = models.CharField(max_length=20, unique=True, editable=False)
    category = models.ForeignKey(TicketCategory, on_delete=models.PROTECT, related_name="tickets")
    department = models.CharField(max_length=20, choices=TicketDepartment.choices, db_index=True)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(
        max_length=10, choices=TicketPriority.choices, default=TicketPriority.MEDIUM
    )
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
        db_index=True,
    )

    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="tickets_raised"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_assigned",
    )
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )

    # Optional link to the record the issue is about (lead, loan, call log, ...).
    linked_content_type = models.ForeignKey(
        ContentType, on_delete=models.PROTECT, null=True, blank=True
    )
    linked_object_id = models.UUIDField(null=True, blank=True)
    linked_object = GenericForeignKey("linked_content_type", "linked_object_id")
    linked_label = models.CharField(max_length=255, blank=True)
    reference_text = models.CharField(
        max_length=255,
        blank=True,
        help_text="Free-text reference such as loan no., UTR or customer mobile.",
    )

    resolution_remark = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_resolved",
    )
    auto_close_at = models.DateTimeField(null=True, blank=True, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_closed",
    )
    close_type = models.CharField(max_length=20, choices=TicketCloseType.choices, blank=True)
    reopen_count = models.PositiveSmallIntegerField(default=0)
    related_ticket = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="follow_up_tickets",
        help_text="Earlier closed ticket this one follows up on.",
    )

    class Meta:
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "assigned_to"]),
            models.Index(fields=["raised_by", "status"]),
            models.Index(fields=["linked_content_type", "linked_object_id"]),
        ]

    def __str__(self):
        return f"{self.ticket_no} — {self.subject}"


class TicketEvent(UUIDPrimaryKeyModel):
    """Append-only history of a ticket's lifecycle (never edited or deleted)."""

    class Kind(models.TextChoices):
        CREATED = "created", "Created"
        ASSIGNED = "assigned", "Assigned"
        STARTED = "started", "Started"
        ON_HOLD = "on_hold", "Put on hold"
        RESOLVED = "resolved", "Resolved"
        REOPENED = "reopened", "Reopened"
        CLOSED = "closed", "Closed"
        AUTO_CLOSED = "auto_closed", "Auto-closed"
        CANCELLED = "cancelled", "Cancelled"

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    from_status = models.CharField(max_length=20, choices=TicketStatus.choices, blank=True)
    to_status = models.CharField(max_length=20, choices=TicketStatus.choices)
    remark = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket_id} {self.kind}"


class TicketComment(UUIDPrimaryKeyModel, TimeStampedModel):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ticket_comments"
    )
    body = models.TextField()
    is_internal = models.BooleanField(
        default=False, help_text="Internal IT note, hidden from the raiser."
    )

    class Meta:
        ordering = ["created_at"]


class TicketAttachment(UUIDPrimaryKeyModel, TimeStampedModel):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ticket_attachments"
    )
    file = models.FileField(upload_to="helpdesk/tickets/%Y/%m/")
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["created_at"]
