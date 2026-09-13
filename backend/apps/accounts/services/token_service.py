from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.tokens import LMSRefreshToken


class TokenService:
    @staticmethod
    def invalidate_existing_sessions(user) -> None:
        """Revoke all refresh tokens and bump session epoch so only the next login is valid."""
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        user.session_epoch = (user.session_epoch or 0) + 1
        user.save(update_fields=["session_epoch"])

    @staticmethod
    def issue_tokens(user) -> dict:
        refresh = LMSRefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    @staticmethod
    def rotate_refresh(refresh_token_str: str) -> dict:
        from django.contrib.auth import get_user_model

        old_refresh = LMSRefreshToken(refresh_token_str)
        user_id = old_refresh["user_id"]
        user = get_user_model().objects.get(pk=user_id, is_active=True)
        old_refresh.blacklist()
        new_refresh = LMSRefreshToken.for_user(user)
        return {
            "access": str(new_refresh.access_token),
            "refresh": str(new_refresh),
        }

    @staticmethod
    def blacklist_refresh(refresh_token_str: str) -> None:
        token = LMSRefreshToken(refresh_token_str)
        token.blacklist()
