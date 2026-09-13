from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel
from apps.customers.models import Customer
from apps.organization.models import Branch
from apps.products.models import LoanProduct
from apps.workflow.models import Workflow, WorkflowState


class ApplicationStatus(models.TextChoices):
    INTERESTED = "interested", "Interested"
    DOCUMENTS_RECEIVED = "documents_received", "Documents Received"
    DOCUMENTS_INCOMPLETE = "documents_incomplete", "Documents Incomplete"
    DOCUMENTS_VERIFIED = "documents_verified", "Documents Verified"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"
    DISBURSAL_SHEET_SENT = "disbursal_sheet_sent", "Disbursal Sheet Sent"
    DISBURSED = "disbursed", "Disbursed"
    CLOSED = "closed", "Closed"


class VerificationType(models.TextChoices):
    KYC = "kyc", "KYC"
    EMPLOYMENT = "employment", "Employment"
    BANK = "bank", "Bank Account"
    ADDRESS = "address", "Address"


class VerificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PASSED = "passed", "Passed"
    FAILED = "failed", "Failed"


class LoanApplication(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel, SoftDeleteModel):
    application_number = models.CharField(max_length=30, unique=True, db_index=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="loan_applications",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    product = models.ForeignKey(
        LoanProduct,
        on_delete=models.PROTECT,
        related_name="applications",
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="applications",
        null=True,
        blank=True,
    )
    requested_amount = models.DecimalField(max_digits=14, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    tenure_value = models.PositiveIntegerField(default=30)
    tenure_unit = models.CharField(max_length=10, default="days")
    purpose = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.INTERESTED,
        db_index=True,
    )
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.PROTECT,
        related_name="applications",
        null=True,
        blank=True,
    )
    current_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.PROTECT,
        related_name="applications_in_state",
        null=True,
        blank=True,
    )
    assigned_rm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rm_applications",
    )
    assigned_cm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cm_applications",
    )
    customer_snapshot = models.JSONField(default=dict, blank=True)
    product_snapshot = models.JSONField(default=dict, blank=True)
    disbursal_sheet_details = models.JSONField(default=dict, blank=True)
    disbursal_sheet_sent_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Loan Application"
        indexes = [
            models.Index(fields=["application_number"]),
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["status", "branch"]),
            models.Index(fields=["assigned_rm", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(requested_amount__gt=0),
                name="application_requested_amount_positive",
            ),
        ]

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

        if is_super_admin(user) or is_admin_user(user):
            return True
        if is_collection_officer(user):
            from apps.loans.models import Loan

            return Loan.objects.filter(
                application=self,
                is_deleted=False,
                disbursed_at__isnull=False,
            ).exists()
        if is_account_finance(user):
            return not self.is_deleted and self.status in FINANCE_VISIBLE_STATUSES
        if user.id in (self.created_by_id, self.assigned_rm_id, self.assigned_cm_id):
            return True

        # Backward/edge-case support:
        # Some applications may not have assignees populated even though the linked Lead does.
        # Allow access based on the linked lead assignment to avoid blocking CM/RM actions.
        lead = None
        if self.lead_id:
            try:
                lead = self.lead
            except Exception:
                lead = None
            if lead and user.id in (lead.assigned_rm_id, lead.assigned_cm_id):
                return True

        rm_id = self.assigned_rm_id or (lead.assigned_rm_id if lead else None)
        cm_id = self.assigned_cm_id or (lead.assigned_cm_id if lead else None)

        if is_senior_relationship_manager(user) and rm_id is not None:
            return True
        if is_senior_credit_manager(user) and cm_id is not None:
            return True

        return False

    def __str__(self):
        return self.application_number


class ApplicationVerification(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name="verifications",
    )
    verification_type = models.CharField(max_length=50, choices=VerificationType.choices)
    status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["application", "verification_type"])]


class ApplicationDecision(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    decision = models.CharField(
        max_length=20,
        choices=[("approved", "Approved"), ("rejected", "Rejected")],
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="application_decisions",
    )
    approved_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    approved_tenure_value = models.PositiveIntegerField(null=True, blank=True)
    interest_rate = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    processing_fee = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    sanction_details = models.JSONField(default=dict, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-decided_at"]

    def __str__(self):
        return f"{self.application.lead.lead_id} - {self.application.application_number}"


class ApplicationStatusHistory(UUIDPrimaryKeyModel, TimeStampedModel):
    application = models.ForeignKey(
        LoanApplication,
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
        related_name="application_status_changes",
    )
    remarks = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Application Status History"
        verbose_name_plural = "Application Status Histories"
        ordering = ["-changed_at"]
