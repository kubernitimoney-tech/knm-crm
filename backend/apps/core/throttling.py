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
