import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import UserApprovalStatus
from apps.accounts.services.auth_context import build_auth_context
from apps.accounts.services.token_service import TokenService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService

logger = logging.getLogger(__name__)
User = get_user_model()

PENDING_APPROVAL_MESSAGE = (
    "Your account is awaiting approval. Please try again once it is approved."
)
REJECTED_APPROVAL_MESSAGE = (
    "Your account request was not approved. Please contact your administrator."
)
TEMPORARY_PASSWORD_EXPIRED_MESSAGE = (
    "Your temporary password has expired. Ask an administrator to reset it."
)


class PasswordChangeError(Exception):
    pass


def _approval_status(user) -> str | None:
    # Users created before onboarding approval existed have no approval row.
    approval = getattr(user, "approval", None)
    return approval.status if approval is not None else None


def temporary_password_expired(user) -> bool:
    return bool(
        user.must_change_password
        and user.password_expires_at
        and user.password_expires_at <= timezone.now()
    )


class AuthService:
    @staticmethod
    def _authenticate_user(email: str, password: str):
        normalized_email = (email or "").strip().lower()
        if not normalized_email or not password:
            return None
        user = (
            User.objects.select_related("approval").filter(email__iexact=normalized_email).first()
        )
        if user is None:
            # Hash anyway so response time does not reveal whether the email exists.
            User().set_password(password)
            return None
        if not user.check_password(password):
            return None
        return user

    @staticmethod
    def login(email: str, password: str) -> dict:
        user = AuthService._authenticate_user(email, password)
        if user is None:
            raise ValueError("Invalid credentials")
        # Account state is revealed only after the password has been verified.
        approval_status = _approval_status(user)
        if approval_status == UserApprovalStatus.PENDING:
            raise ValueError(PENDING_APPROVAL_MESSAGE)
        if approval_status == UserApprovalStatus.REJECTED:
            raise ValueError(REJECTED_APPROVAL_MESSAGE)
        if not user.is_active:
            raise ValueError("Account is inactive")
        if temporary_password_expired(user):
            raise ValueError(TEMPORARY_PASSWORD_EXPIRED_MESSAGE)
        try:
            TokenService.invalidate_existing_sessions(user)
            update_last_login(None, user)
            tokens = TokenService.issue_tokens(user)
            context = build_auth_context(user)
            UserActivityService.log(
                user=user,
                action=UserActivityAction.LOGIN,
                description="User signed in",
            )
        except Exception as exc:
            logger.exception("Login session setup failed for %s", email)
            raise RuntimeError("Unable to complete sign in. Please try again.") from exc
        return {**context, "tokens": tokens}

    @staticmethod
    def change_password(user, *, current_password: str, new_password: str) -> dict:
        """Replace the user's password, end every other session and return fresh tokens."""
        if not user.check_password(current_password or ""):
            raise PasswordChangeError("Current password is incorrect.")
        if current_password == new_password:
            raise PasswordChangeError("New password must be different from the current one.")
        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            raise PasswordChangeError(" ".join(exc.messages)) from exc

        with transaction.atomic():
            user.set_password(new_password)
            user.must_change_password = False
            user.password_expires_at = None
            user.password_changed_at = timezone.now()
            user.save(
                update_fields=[
                    "password",
                    "must_change_password",
                    "password_expires_at",
                    "password_changed_at",
                    "updated_at",
                ]
            )
            TokenService.invalidate_existing_sessions(user)
            tokens = TokenService.issue_tokens(user)

        UserActivityService.log(
            user=user,
            action=UserActivityAction.UPDATE,
            description="User changed their password",
        )
        return {**build_auth_context(user), "tokens": tokens}
