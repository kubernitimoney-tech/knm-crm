"""
Lead domain — CRM only. Lending lifecycle lives in applications/loans.
"""

from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel
from apps.customers.models import Customer


class LeadSource(UUIDPrimaryKeyModel, TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Lead Source"
        verbose_name_plural = "Lead Sources"
        ordering = ["name"]

    def __str__(self):
        return self.name


class LeadCategory(models.TextChoices):
    FRESH = "fresh", "Fresh"
    RELOAN = "reloan", "Reloan"


class LeadCloserType(models.TextChoices):
    """Why a lead was closed (DND, invalid number, etc.)."""

    DND = "dnd", "DND"
    INVALID_NUMBER = "invalid_number", "Invalid Number"
    NOT_INTERESTED = "not_interested", "Not Interested"
    DUPLICATE_LEAD = "duplicate_lead", "Duplicate Lead"
    OTHER = "other", "Other"


class LeadStatus(models.TextChoices):
    FRESH = "fresh", "Fresh"
    RELOAN = "reloan", "Reloan"
    BUSY = "busy", "Busy"
    CALL_BACK = "call_back", "Call Back"
    INTERESTED = "interested", "Interested"
    DOCUMENTS_PENDING = "documents_pending", "Document Pending"
    DOCUMENTS_RECEIVED = "documents_received", "Documents Received"
    NOT_INTERESTED = "not_interested", "Not Interested"
    DUPLICATE_LEAD = "duplicate_lead", "Duplicate Lead"
    INVALID_NUMBER = "invalid_number", "Invalid Number"
    LOAN_RUNNING = "loan_running", "Loan Running"
    PART_PAYMENT = "part_payment", "Part Payment"
    PAYDAY_PRE_CLOSE = "payday_pre_close", "Payday Pre-Close"
    CLOSED = "closed", "Closed"
    SETTLEMENT = "settlement", "Settlement"


TERMINAL_LEAD_STATUSES = frozenset(
    {
        LeadStatus.DUPLICATE_LEAD,
        LeadStatus.INVALID_NUMBER,
        LeadStatus.CLOSED,
        LeadStatus.PAYDAY_PRE_CLOSE,
        LeadStatus.SETTLEMENT,
    }
)

# Lead statuses that must not change when logging a call (matches hidden call-button rules).
CALL_LOG_IMMUTABLE_STATUSES = frozenset(
    {
        LeadStatus.CLOSED,
        LeadStatus.INVALID_NUMBER,
        LeadStatus.INTERESTED,
        LeadStatus.DOCUMENTS_PENDING,
        LeadStatus.DOCUMENTS_RECEIVED,
        LeadStatus.PAYDAY_PRE_CLOSE,
        LeadStatus.SETTLEMENT,
    }
)


class Lead(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel, SoftDeleteModel):
    lead_id = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="leads",
    )
    source = models.ForeignKey(
        LeadSource,
        on_delete=models.PROTECT,
        related_name="leads",
        null=True,
        blank=True,
    )
    interested_product = models.ForeignKey(
        "products.LoanProduct",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
    )
    assigned_rm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rm_leads",
    )
    assigned_cm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cm_leads",
    )
    required_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    loan_purpose = models.CharField(max_length=100, blank=True)
    category = models.CharField(
        max_length=10,
        choices=LeadCategory.choices,
        default=LeadCategory.FRESH,
    )
    status = models.CharField(
        max_length=25,
        choices=LeadStatus.choices,
        default=LeadStatus.FRESH,
        db_index=True,
    )
    close_reason = models.CharField(
        max_length=30,
        choices=LeadCloserType.choices,
        blank=True,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    converted_application = models.OneToOneField(
        "applications.LoanApplication",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_from_lead",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Lead"
        verbose_name_plural = "Leads"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["assigned_rm", "status"]),
            models.Index(fields=["assigned_cm", "status"]),
            models.Index(fields=["customer", "status"]),
        ]

    def __str__(self):
        return self.lead_id

    @property
    def is_in_progress(self) -> bool:
        return self.status not in TERMINAL_LEAD_STATUSES

    def check_user_access(self, user) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False

        from apps.accounts.services.role_helpers import (
            is_account_finance,
            is_admin_user,
            is_collection_officer,
            is_senior_credit_manager,
            is_senior_relationship_manager,
            is_super_admin,
        )
        from apps.applications.constants import FINANCE_VISIBLE_STATUSES
        from apps.loans.selectors.loan_selectors import disbursed_loan_exists_filter

        if is_super_admin(user) or is_admin_user(user):
            return True
        if is_collection_officer(user):
            return self.applications.filter(
                disbursed_loan_exists_filter(prefix="loan__"),
                is_deleted=False,
            ).exists()
        if is_account_finance(user):
            if self.converted_application_id:
                app = self.converted_application
                if app and not app.is_deleted and app.status in FINANCE_VISIBLE_STATUSES:
                    return True
            if self.applications.filter(
                is_deleted=False,
                status__in=FINANCE_VISIBLE_STATUSES,
            ).exists():
                return True
            return self.applications.filter(
                disbursed_loan_exists_filter(prefix="loan__"),
                is_deleted=False,
            ).exists()
        if user.id in (
            self.created_by_id,
            self.assigned_rm_id,
            self.assigned_cm_id,
        ):
            return True
        if is_senior_relationship_manager(user) and self.assigned_rm_id is not None:
            return True
        if is_senior_credit_manager(user) and self.assigned_cm_id is not None:
            return True
        return False


class DeletedLead(Lead):
    """Admin-only proxy to list soft-deleted leads."""

    class Meta:
        proxy = True
        verbose_name = "Deleted lead"
        verbose_name_plural = "Deleted leads"


class LeadAssignmentHistory(UUIDPrimaryKeyModel, TimeStampedModel):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="assignment_history",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="lead_assignments_made",
    )
    old_rm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    new_rm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    old_cm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    new_cm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    remarks = models.TextField(blank=True)

    class Meta:
        verbose_name = "Lead Assignment History"
        verbose_name_plural = "Lead Assignment Histories"
        ordering = ["-created_at"]


class CallDisposition(models.TextChoices):
    BUSY = "busy", "Busy"
    CALL_BACK = "call_back", "Call Back"
    CALL_DISCONNECTED = "call_disconnected", "Call Disconnected"
    DUPLICATE_LEAD = "duplicate_lead", "Duplicate Lead"
    LOAN_RUNNING = "loan_running", "Loan Running"
    INTERESTED = "interested", "Interested"
    DOCUMENTS_PENDING = "documents_pending", "Document Pending"
    DOCUMENTS_RECEIVED = "documents_received", "Documents Received"
    INVALID_NUMBER = "invalid_number", "Invalid Number"
    NO_ANSWER = "no_answer", "No Answer"
    NOT_INTERESTED = "not_interested", "Not Interested"
    SWITCHED_OFF = "switched_off", "Switched Off"
    OTHER = "other", "Other"


class CallLog(UUIDPrimaryKeyModel, TimeStampedModel):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="call_logs",
    )
    disposition = models.CharField(max_length=30, choices=CallDisposition.choices)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="call_logs_made",
    )

    class Meta:
        verbose_name = "Call Log"
        verbose_name_plural = "Call Logs"
        ordering = ["-created_at"]


class LeadActivityType(models.TextChoices):
    NOTE = "note", "Note"
    STATUS_CHANGE = "status_change", "Status Change"
    ASSIGNMENT = "assignment", "Assignment"


class LeadActivity(UUIDPrimaryKeyModel, TimeStampedModel):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    activity_type = models.CharField(max_length=50, choices=LeadActivityType.choices)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name_plural = "Lead activities"
        ordering = ["-created_at"]


class LeadFollowUpRemark(UUIDPrimaryKeyModel, TimeStampedModel):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="follow_up_remarks",
    )
    remark_category = models.CharField(max_length=100)
    follow_up_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=20)
    notes = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_follow_up_remarks",
    )

    class Meta:
        ordering = ["-created_at"]


class LeadStatusHistory(UUIDPrimaryKeyModel, TimeStampedModel):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=30, blank=True, default="")
    to_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_status_changes",
    )
    remarks = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lead Status History"
        verbose_name_plural = "Lead Status Histories"
        ordering = ["-changed_at"]
