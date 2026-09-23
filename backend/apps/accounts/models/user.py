import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.accounts.managers import UserManager

EMPLOYEE_CODE_PREFIX = "KNM"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user — email is the login identifier (USERNAME_FIELD).

    Field rationale:
    - id (UUID): opaque PK, safe in APIs, no user count leakage.
    - email: unique login + communication channel for FinTech KYC flows.
    - first_name / last_name: legal and UI identity.
    - mobile_number: OTP, SMS alerts, regulatory contact.
    - is_active: account enabled (distinct from soft-delete on business entities).
    - is_staff: Django admin access; not the same as RBAC roles.
    - is_verified: email/phone KYC completed before sensitive actions.
    - last_login: security monitoring, idle session policies.
    - created_at / updated_at: lifecycle auditing on the identity itself.
    - employee_code: human-readable staff identifier (e.g. KNM0001) for HR/UI.
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
        help_text="Primary login identifier. Must be unique across the system.",
    )
    first_name = models.CharField(
        max_length=150,
        verbose_name="First name",
        help_text="Given name as per official records.",
    )
    last_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Last name",
        help_text="Family name as per official records.",
    )
    mobile_number = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        verbose_name="Mobile number",
        help_text="E.164 or local format mobile for OTP and notifications.",
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
        help_text="True after email/phone verification for regulated actions.",
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
        if not self.employee_code:
            self.employee_code = self.generate_employee_code()
        super().save(*args, **kwargs)
