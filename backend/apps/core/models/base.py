"""
Reusable abstract base models.

Inheritance strategy (compose, do not deep-chain blindly):
- TimeStampedModel: every persisted row that needs audit timestamps.
- AuditModel: adds created_by/updated_by for human-attributed changes.
  Inherit TimeStampedModel + AuditModel for staff-managed entities.
- SoftDeleteModel: business entities only (Customer, Loan, etc.).
  Operational/junction tables (LoanStatusHistory) use hard delete or
  retain rows for compliance — never soft-delete audit trails.

Order for business entities:
    class Customer(TimeStampedModel, AuditModel, SoftDeleteModel):
        ...

UUID primary keys live on each concrete model (not on abstracts) so
migrations stay explicit per table.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.soft_delete_context import mark_soft_delete


class TimeStampedModel(models.Model):
    """Automatic created/updated timestamps — no manual bookkeeping in views."""

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created at",
        help_text="UTC timestamp when this record was first persisted.",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated at",
        help_text="UTC timestamp of the most recent save.",
    )

    class Meta:
        abstract = True


class AuditModel(models.Model):
    """
    Tracks which user created or last modified a record.
    Set in service layer via request.user, not in serializers.
    """

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_created",
        verbose_name="Created by",
        help_text="User who created this record.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_updated",
        verbose_name="Updated by",
        help_text="User who last updated this record.",
    )

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        return super().update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def all_with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def dead(self):
        return self.all_with_deleted().filter(is_deleted=True)


class SoftDeleteModel(models.Model):
    """
    Logical delete for business entities — preserves referential integrity
    and regulatory history while hiding records from default queries.
    """

    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Is deleted",
        help_text="True when this record has been soft-deleted.",
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Deleted at",
        help_text="UTC timestamp of soft deletion.",
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_deleted",
        verbose_name="Deleted by",
        help_text="User who performed the soft delete.",
    )

    objects = SoftDeleteManager()

    class AllObjectsManager(models.Manager):
        def get_queryset(self):
            return SoftDeleteQuerySet(self.model, using=self._db)

    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False, user=None):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        if user is not None:
            self.deleted_by = user
        mark_soft_delete(self)
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by", "updated_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)


class UUIDPrimaryKeyModel(models.Model):
    """
    UUID PK for business entities.

    Security: non-sequential IDs prevent enumeration attacks (guessing /loan/1, /loan/2).
    API exposure: stable, opaque identifiers safe in URLs and mobile clients.
    Distributed: IDs generated client-side or across services without DB coordination.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    class Meta:
        abstract = True
