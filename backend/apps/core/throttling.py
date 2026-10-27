"""Stricter DRF throttles for sensitive public endpoints (rates in settings)."""

from rest_framework.throttling import SimpleRateThrottle


class _ScopedAnonThrottle(SimpleRateThrottle):
    """Throttle every caller of a public endpoint by client IP."""

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class PublicLookupThrottle(_ScopedAnonThrottle):
    scope = "public_lookup"


class OtpThrottle(_ScopedAnonThrottle):
    scope = "otp"


class LoginThrottle(_ScopedAnonThrottle):
    """Slows down password guessing against the sign-in endpoint."""

    scope = "login"


class PasswordChangeThrottle(SimpleRateThrottle):
    """Throttle password changes per signed-in user."""

    scope = "password_change"

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user and request.user.is_authenticated else None
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident or self.get_ident(request),
        }
