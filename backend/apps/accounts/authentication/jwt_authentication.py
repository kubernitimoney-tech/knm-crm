"""
Custom JWT authentication implementing DRF BaseAuthentication.

Lifecycle:
1. authenticate() runs before the view — extracts Bearer token from Authorization header.
2. On success returns (user, token_payload) tuple:
   - request.user is set to the User instance (via DRF authentication).
   - request.auth holds the validated token claims dict (not the raw string).
3. On failure raises AuthenticationFailed — DRF returns 401.
4. authenticate_header() returns 'Bearer' for WWW-Authenticate on 401.

Token rotation & blacklist: handled in TokenService using SimpleJWT with
ROTATE_REFRESH_TOKENS and BLACKLIST_AFTER_ROTATION in settings.
"""

from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.tokens import SESSION_EPOCH_CLAIM
from apps.audit_logs.middleware import update_audit_user

SESSION_INVALIDATED_MESSAGE = "Session invalidated. Please sign in again."
PASSWORD_CHANGE_REQUIRED_CODE = "password_change_required"
PASSWORD_CHANGE_REQUIRED_MESSAGE = "You must change your password before continuing."
# Endpoints a user with a temporary password may still call.
PASSWORD_CHANGE_ALLOWED_URL_NAMES = frozenset({"auth-me", "auth-logout", "auth-change-password"})

User = get_user_model()


class JWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        raw_token = parts[1]
        user, payload = self.authenticate_credentials(raw_token)
        if user.must_change_password and not self._password_change_allowed(request):
            raise PermissionDenied(
                {"detail": PASSWORD_CHANGE_REQUIRED_MESSAGE, "code": PASSWORD_CHANGE_REQUIRED_CODE}
            )
        return user, payload

    @staticmethod
    def _password_change_allowed(request) -> bool:
        match = getattr(getattr(request, "_request", request), "resolver_match", None)
        return bool(match and match.url_name in PASSWORD_CHANGE_ALLOWED_URL_NAMES)

    def authenticate_credentials(self, raw_token):
        try:
            validated = AccessToken(raw_token)
        except TokenError as exc:
            raise AuthenticationFailed("Invalid or expired token.") from exc

        user_id = validated.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token missing user claim.")

        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed("User not found or inactive.") from exc

        token_epoch = validated.get(SESSION_EPOCH_CLAIM)
        if token_epoch is None:
            if user.session_epoch > 0:
                raise AuthenticationFailed(SESSION_INVALIDATED_MESSAGE)
        elif token_epoch != user.session_epoch:
            raise AuthenticationFailed(SESSION_INVALIDATED_MESSAGE)

        update_audit_user(user)
        return (user, validated.payload)

    def authenticate_header(self, request):
        return self.keyword
