from rest_framework_simplejwt.tokens import RefreshToken

SESSION_EPOCH_CLAIM = "session_epoch"


class LMSRefreshToken(RefreshToken):
    """JWT refresh token that embeds the user's current session epoch in both tokens."""

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        epoch = getattr(user, "session_epoch", 0) or 0
        token[SESSION_EPOCH_CLAIM] = epoch
        return token
