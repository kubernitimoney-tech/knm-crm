"""Resolve the real client IP without trusting client-supplied headers."""

from __future__ import annotations

from django.conf import settings


def trusted_proxy_count() -> int:
    try:
        return max(int(settings.REST_FRAMEWORK.get("NUM_PROXIES") or 0), 0)
    except (TypeError, ValueError):
        return 0


def get_client_ip(request) -> str:
    """
    Use REMOTE_ADDR unless Django sits behind ``NUM_PROXIES`` trusted proxies.

    Each trusted proxy appends the address it saw to X-Forwarded-For, so the
    real client is the entry ``NUM_PROXIES`` places from the right. Anything
    further left was written by the client and is ignored. This matches DRF's
    throttling so rate limits and audit logs see the same address.
    """
    remote_addr = (request.META.get("REMOTE_ADDR") or "").strip()
    proxies = trusted_proxy_count()
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR") or ""
    if proxies and forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-min(proxies, len(hops))]
    return remote_addr
