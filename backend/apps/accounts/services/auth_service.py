import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login

from apps.accounts.services.auth_context import build_auth_context
from apps.accounts.services.token_service import TokenService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService

logger = logging.getLogger(__name__)
User = get_user_model()


class AuthService:
    @staticmethod
    def _authenticate_user(email: str, password: str):
        normalized_email = User.objects.normalize_email((email or "").strip())
        if not normalized_email or not password:
            return None
        user = User.objects.filter(email__iexact=normalized_email).first()
        if user is None or not user.check_password(password):
            return None
        return user

    @staticmethod
    def login(email: str, password: str) -> dict:
        user = AuthService._authenticate_user(email, password)
        if user is None:
            raise ValueError("Invalid credentials")
        if not user.is_active:
            raise ValueError("Account is inactive")
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
