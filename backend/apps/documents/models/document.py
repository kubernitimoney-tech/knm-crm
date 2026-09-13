import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.encryption import EncryptedCharField
from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel
from apps.core.verification import EntryVerificationStatus, is_verified_status


class DocumentType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    is_required = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Document Type"

    def __str__(self):
        return self.name


class Document(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    """Generic document attachable to Customer, LoanApplication, Loan, CollectionCase."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey("content_type", "object_id")
    document_type = models.ForeignKey(
        DocumentType,
        on_delete=models.PROTECT,
        related_name="documents",
    )
    title = models.CharField(max_length=255, blank=True)
    password = EncryptedCharField(
        blank=True,
        help_text="Optional password required to open protected files (encrypted at rest).",
    )
    is_verified = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=20,
        choices=EntryVerificationStatus.choices,
        default=EntryVerificationStatus.UNVERIFIED,
    )
    virus_scan_status = models.CharField(
        max_length=20,
        default="pending",
        help_text="pending | clean | infected",
    )
    current_version = models.ForeignKey(
        "DocumentVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["document_type"]),
        ]

    def save(self, *args, **kwargs):
        self.is_verified = is_verified_status(self.verification_status)
        super().save(*args, **kwargs)


class DocumentVersion(UUIDPrimaryKeyModel, TimeStampedModel):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to="documents/%Y/%m/", max_length=512)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField()
    mime_type = models.CharField(max_length=255, blank=True)
    checksum = models.CharField(max_length=64, blank=True)
    storage_backend = models.CharField(max_length=50, default="local")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document", "version_number"],
                name="unique_document_version",
            ),
        ]
        ordering = ["-version_number"]
