"""
CRM user onboarding with maker-checker approval.

create_user  -> user is inactive + unverified, approval is pending, temporary password
approve      -> user becomes active + verified; temporary password clock starts
reject       -> user stays inactive; sessions revoked
resubmit     -> a rejected request goes back to pending with fresh evidence
"""

from __future__ import annotations

import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import (
    Role,
    RoleStatus,
    User,
    UserApproval,
    UserApprovalStatus,
    UserProfile,
)
from apps.accounts.services.role_helpers import (
    SUPER_ADMIN_SLUG,
    actor_can_assign_role_slug,
    can_assign_roles,
    can_create_users,
    is_super_admin,
)
from apps.accounts.services.role_service import RoleService, RoleServiceError
from apps.accounts.services.token_service import TokenService
from apps.accounts.services.user_service import UserService
from apps.accounts.usernames import generate_unique_username
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.core.validators.attachments import safe_attachment_display_name

_USERNAME_RETRIES = 3


class UserOnboardingError(Exception):
    pass


def temporary_password_expiry():
    return timezone.now() + timedelta(hours=settings.TEMPORARY_PASSWORD_TTL_HOURS)


def _store_attachment_name(attachment) -> str:
    """Rename the upload to a random name; return the original name for display."""
    original = safe_attachment_display_name(attachment.name)
    attachment.name = f"{uuid.uuid4().hex}{os.path.splitext(original)[1].lower()}"
    return original


class UserOnboardingService:
    @staticmethod
    def suggest_username(email: str) -> str:
        return generate_unique_username(email)

    @staticmethod
    def _validate_role(actor, role_slug: str | None) -> None:
        if not can_assign_roles(actor):
            if role_slug:
                raise UserOnboardingError("Only Super Admin and Admin can assign roles.")
            return
        if not role_slug:
            raise UserOnboardingError("Select a role for the new user.")
        if not actor_can_assign_role_slug(actor, role_slug):
            raise UserOnboardingError("You are not allowed to assign this role.")
        if role_slug == SUPER_ADMIN_SLUG and not is_super_admin(actor):
            raise UserOnboardingError("Only Super Admin can assign the Super Admin role.")
        if not Role.objects.filter(
            slug=role_slug, is_active=True, status=RoleStatus.ACTIVE
        ).exists():
            raise UserOnboardingError(f"Unknown or inactive role: {role_slug}")

    @staticmethod
    def _save_with_unique_username(user: User) -> None:
        for attempt in range(_USERNAME_RETRIES):
            user.username = generate_unique_username(user.email)
            try:
                with transaction.atomic():
                    user.save()
                return
            except IntegrityError:
                if User.objects.filter(email__iexact=user.email).exists():
                    raise UserOnboardingError("A user with this email already exists.") from None
                if attempt == _USERNAME_RETRIES - 1:
                    raise
        raise UserOnboardingError("Could not allocate a username. Please try again.")

    @classmethod
    def create_user(
        cls,
        *,
        actor,
        email: str,
        first_name: str,
        middle_name: str = "",
        last_name: str = "",
        display_name: str = "",
        password: str = "",
        mobile_number: str,
        branch,
        address: str = "",
        role_slug: str | None = None,
        attachment,
        request_remarks: str,
    ) -> tuple[User, str | None]:
        """Create an inactive user awaiting approval.

        Returns the user and the generated temporary password, or ``None`` when
        the creator typed the password themselves.
        """
        if not can_create_users(actor):
            raise UserOnboardingError("Only Super Admin and Admin can create users.")
        cls._validate_role(actor, role_slug)

        generated = not password
        password = password or UserService.generate_temporary_password()

        user = User(
            email=email.strip().lower(),
            first_name=first_name.strip(),
            middle_name=middle_name.strip(),
            last_name=last_name.strip(),
            display_name=display_name.strip(),
            is_active=False,
            is_verified=False,
            must_change_password=True,
            created_by=actor,
            updated_by=actor,
        )
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise UserOnboardingError(" ".join(exc.messages)) from exc
        user.set_password(password)

        with transaction.atomic():
            cls._save_with_unique_username(user)
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "mobile_number": mobile_number,
                    "branch": branch,
                    "address": address.strip(),
                },
            )
            attachment_name = _store_attachment_name(attachment)
            approval = UserApproval.objects.create(
                user=user,
                attachment=attachment,
                attachment_name=attachment_name,
                request_remarks=request_remarks.strip(),
                created_by=actor,
            )
            if role_slug:
                try:
                    RoleService.assign_role(
                        actor=actor,
                        target_user=user,
                        role_slug=role_slug,
                        approval_email=approval.attachment,
                        confirm=True,
                    )
                except RoleServiceError as exc:
                    raise UserOnboardingError(str(exc)) from exc

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.CREATE,
            description=f"Created CRM user {user.username} ({user.email}) pending approval",
            metadata={"target_user_id": str(user.pk), "role_slug": role_slug or ""},
        )
        return user, (password if generated else None)

    @staticmethod
    def _lock_pending_approval(actor, user) -> UserApproval:
        try:
            approval = UserApproval.objects.select_for_update().get(user=user)
        except UserApproval.DoesNotExist as exc:
            raise UserOnboardingError("This user has no approval request.") from exc
        if approval.status != UserApprovalStatus.PENDING:
            raise UserOnboardingError(
                f"This request is already {approval.get_status_display().lower()}."
            )
        if actor.pk == user.pk:
            raise UserOnboardingError("You cannot review your own account.")
        if approval.created_by_id == actor.pk:
            raise UserOnboardingError(
                "You submitted this request, so another approver must review it."
            )
        return approval

    @classmethod
    def approve(cls, *, actor, user, remarks: str = "") -> UserApproval:
        with transaction.atomic():
            approval = cls._lock_pending_approval(actor, user)
            now = timezone.now()
            approval.status = UserApprovalStatus.APPROVED
            approval.approved_by = actor
            approval.approved_at = now
            approval.approver_remarks = remarks.strip()
            approval.save()

            user.is_active = True
            user.is_verified = True
            user.updated_by = actor
            # The temporary password only starts its clock once the user can sign in.
            if user.must_change_password:
                user.password_expires_at = temporary_password_expiry()
            user.save(
                update_fields=[
                    "is_active",
                    "is_verified",
                    "updated_by",
                    "password_expires_at",
                    "updated_at",
                ]
            )

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.APPROVE,
            description=f"Approved CRM user {user.username} ({user.email})",
            metadata={"target_user_id": str(user.pk)},
        )
        return approval

    @classmethod
    def reject(cls, *, actor, user, remarks: str) -> UserApproval:
        remarks = (remarks or "").strip()
        if not remarks:
            raise UserOnboardingError("Remarks are required when rejecting a request.")

        with transaction.atomic():
            approval = cls._lock_pending_approval(actor, user)
            approval.status = UserApprovalStatus.REJECTED
            approval.approved_by = actor
            approval.approved_at = timezone.now()
            approval.approver_remarks = remarks
            approval.save()

            user.is_active = False
            user.is_verified = False
            user.updated_by = actor
            user.save(update_fields=["is_active", "is_verified", "updated_by", "updated_at"])
            TokenService.invalidate_existing_sessions(user)

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.REJECT,
            description=f"Rejected CRM user {user.username} ({user.email})",
            metadata={"target_user_id": str(user.pk), "remarks": remarks[:500]},
        )
        return approval

    @classmethod
    def resubmit(cls, *, actor, user, attachment, request_remarks: str) -> UserApproval:
        if not can_create_users(actor):
            raise UserOnboardingError("Only Super Admin and Admin can resubmit requests.")

        with transaction.atomic():
            try:
                approval = UserApproval.objects.select_for_update().get(user=user)
            except UserApproval.DoesNotExist as exc:
                raise UserOnboardingError("This user has no approval request.") from exc
            if approval.status != UserApprovalStatus.REJECTED:
                raise UserOnboardingError("Only a rejected request can be resubmitted.")

            # The previous file stays in storage as evidence for the earlier decision.
            approval.attachment_name = _store_attachment_name(attachment)
            approval.attachment = attachment
            approval.request_remarks = request_remarks.strip()
            approval.status = UserApprovalStatus.PENDING
            approval.created_by = actor
            approval.created_at = timezone.now()
            approval.approved_by = None
            approval.approved_at = None
            approval.approver_remarks = ""
            approval.save()

        UserActivityService.log(
            user=actor,
            action=UserActivityAction.SUBMIT,
            description=f"Resubmitted approval for CRM user {user.username} ({user.email})",
            metadata={"target_user_id": str(user.pk)},
        )
        return approval
