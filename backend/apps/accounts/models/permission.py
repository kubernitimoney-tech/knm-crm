import uuid

from django.db import models


class PermissionModule(models.TextChoices):
    CUSTOMER = "customer", "Customer"

    LEAD = "lead", "Lead"

    APPLICATION = "application", "Application"

    SANCTION = "sanction", "Sanction"

    DISBURSAL = "disbursal", "Disbursal"

    LOAN = "loan", "Loan"

    DOCUMENT = "document", "Document"

    ADDRESS = "address", "Address"

    COMPANY = "company", "Company"

    REFERENCE = "reference", "Reference"

    DASHBOARD = "dashboard", "Dashboard"

    REPORT = "report", "Report"

    USER = "user", "User"

    ROLE = "role", "Role"

    WORKFLOW = "workflow", "Workflow"

    CALL_LOG = "call_log", "Call Log"

    FIELD_INVESTIGATION = "field_investigation", "Field Investigation"

    COLLECTION = "collection", "Collection"

    REDFLAG = "redflag", "Red Flag"

    PERMISSION = "permission", "Permission"

    AUDIT = "audit", "Audit"


class PermissionAction(models.TextChoices):
    VIEW = "view", "View"

    CREATE = "create", "Create"

    UPDATE = "update", "Update"

    DELETE = "delete", "Delete"

    APPROVE = "approve", "Approve"

    REJECT = "reject", "Reject"

    ASSIGN = "assign", "Assign"

    UPLOAD = "upload", "Upload"

    REUPLOAD = "reupload", "Reupload"

    DOWNLOAD = "download", "Download"

    EXPORT = "export", "Export"

    SANCTION = "sanction", "Sanction"

    SUBMIT = "submit", "Submit"

    SEND = "send", "Send"

    CONVERT = "convert", "Convert"

    VERIFY = "verify", "Verify"

    GRANT = "grant", "Grant"

    REVOKE = "revoke", "Revoke"


class PermissionStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Permission(models.Model):
    """

    Permissions are never hand-typed — module + action produce code.

    Example: module=application, action=approve → application.approve

    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    module = models.CharField(
        max_length=50,
        choices=PermissionModule.choices,
        verbose_name="Module",
        help_text="Functional area this permission applies to.",
    )

    action = models.CharField(
        max_length=50,
        choices=PermissionAction.choices,
        verbose_name="Action",
        help_text="Operation allowed within the module.",
    )

    code = models.CharField(
        max_length=100,
        unique=True,
        editable=False,
        db_index=True,
        verbose_name="Permission code",
        help_text="Auto-generated as module.action (e.g. application.approve).",
    )

    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=PermissionStatus.choices,
        default=PermissionStatus.ACTIVE,
        db_index=True,
        verbose_name="Status",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Permission"

        verbose_name_plural = "Permissions"

        constraints = [
            models.UniqueConstraint(
                fields=["module", "action"],
                name="unique_permission_module_action",
            ),
        ]

        indexes = [
            models.Index(fields=["module", "action"]),
        ]

        ordering = ["code"]

    def save(self, *args, **kwargs):
        self.code = f"{self.module}.{self.action}"

        super().save(*args, **kwargs)

    def __str__(self):
        return self.code
