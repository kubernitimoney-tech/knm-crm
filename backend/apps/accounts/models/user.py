import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.accounts.managers import UserManager
from apps.accounts.usernames import (
    USERNAME_MAX_LENGTH,
    generate_unique_username,
    validate_username,
)

EMPLOYEE_CODE_PREFIX = "KNM"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user — email is the login identifier (USERNAME_FIELD).

    Contact details (mobile, branch, address) live on ``UserProfile``; the
    onboarding approval lives on ``UserApproval``.

    Field rationale:
    - id (UUID): opaque PK, safe in APIs, no user count leakage.
    - email: unique lowercase login + communication channel.
    - username: lowercase CRM handle derived from the email (pankaj, pankaj1, ...).
    - first_name / middle_name / last_name: legal identity; loan and business data
      use first + last name (``get_full_name``).
    - display_name: optional name for the app shell only (navbar, sidebar, profile).
    - is_active: account can log in. New CRM users stay inactive until approved.
    - is_staff: Django admin access; not the same as RBAC roles.
    - is_verified: onboarding approval granted.
    - must_change_password / password_expires_at: temporary password set by an
      admin; the user must replace it, and it stops working once expired.
    - last_login: security monitoring, idle session policies.
    - created_by / updated_by / created_at / updated_at: lifecycle auditing.
    - employee_code: internal sequential identifier (e.g. KNM0001).
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID",
        help_text="Unique identifier for this user.",
    )
    email = models.EmailField(
        unique=True,
        db_index=True,
        verbose_name="Email address",
        help_text="Primary login identifier. Stored lowercase; unique across the system.",
    )
    username = models.CharField(
        max_length=USERNAME_MAX_LENGTH,
        unique=True,
        validators=[validate_username],
        verbose_name="Username",
        help_text="Lowercase CRM handle generated from the email (e.g. pankaj, pankaj1).",
    )
    first_name = models.CharField(
        max_length=150,
        verbose_name="First name",
        help_text="Given name as per official records.",
    )
    middle_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Middle name",
    )
    last_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Last name",
        help_text="Family name as per official records.",
    )
    display_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Display name",
        help_text=(
            "Shown only in the app shell (navbar, sidebar, profile). Loan and audit "
            "records always use the official first/last name."
        ),
    )
    employee_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False,
        verbose_name="Employee code",
        help_text="Human-readable employee identifier (e.g. KNM0001).",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Active",
        help_text="Designates whether this user can log in.",
    )
    is_staff = models.BooleanField(
        default=False,
        verbose_name="Staff status",
        help_text="Grants access to Django admin. Does not imply loan permissions.",
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name="Verified",
        help_text="True once the onboarding approval has been granted.",
    )
    must_change_password = models.BooleanField(
        default=False,
        verbose_name="Must change password",
        help_text="Set when an admin issues a temporary password; cleared on change.",
    )
    password_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Password changed at",
    )
    password_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Temporary password expires at",
        help_text="A temporary password cannot be used to sign in after this time.",
    )
    last_login = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last login",
        help_text="Timestamp of the most recent successful authentication.",
    )
    session_epoch = models.PositiveIntegerField(
        default=0,
        verbose_name="Session epoch",
        help_text="Incremented on each login to invalidate tokens from prior sessions.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_created",
        verbose_name="Created by",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_updated",
        verbose_name="Updated by",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created at",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated at",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        indexes = [
            models.Index(fields=["email", "is_active"]),
            models.Index(fields=["created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(email=""),
                name="accounts_user_email_not_empty",
            ),
        ]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip().title()

    def get_display_name(self):
        """Name for the app shell only; use ``get_full_name`` for loan/business data."""
        return self.display_name.strip() or self.get_full_name() or self.email

    @classmethod
    def generate_employee_code(cls) -> str:
        last = cls.objects.exclude(employee_code="").order_by("-created_at").first()
        seq = 1
        if last and last.employee_code:
            digits = "".join(ch for ch in last.employee_code if ch.isdigit())
            if digits:
                seq = int(digits) + 1
        return f"{EMPLOYEE_CODE_PREFIX}{seq:04d}"

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        self.username = (self.username or "").strip().lower()
        if not self.username:
            self.username = generate_unique_username(self.email, exclude_pk=self.pk)
        if not self.employee_code:
            self.employee_code = self.generate_employee_code()
        super().save(*args, **kwargs)
