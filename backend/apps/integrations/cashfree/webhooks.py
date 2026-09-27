from __future__ import annotations

import base64
import hashlib
import hmac
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def _clean_secret(value: str) -> str:
    secret = (value or "").strip()
    if len(secret) >= 2 and secret[0] == secret[-1] and secret[0] in {'"', "'"}:
        secret = secret[1:-1].strip()
    return secret


def webhook_secrets() -> list[str]:
    # Client secret is what Cashfree uses to sign. A separate webhook secret is
    # accepted too, but it must not hide a valid client secret.
    found: list[str] = []
    for raw in (settings.CASHFREE_CLIENT_SECRET, settings.CASHFREE_WEBHOOK_SECRET):
        secret = _clean_secret(raw)
        if secret and secret not in found:
            found.append(secret)
    return found


def verify_webhook_signature(*, raw_body: bytes, signature: str, timestamp: str) -> bool:
    """
    Cashfree signs ``timestamp + raw body`` with HMAC-SHA256 and sends the
    base64 digest in ``x-webhook-signature``.
    """
    secrets = webhook_secrets()
    provided = (signature or "").strip()
    signed_at = (timestamp or "").strip()
    if not secrets:
        logger.warning("Cashfree webhook accepted without a configured secret")
        return True
    if not provided or not signed_at:
        return False
    signed = signed_at.encode() + raw_body
    for secret in secrets:
        digest = hmac.new(secret.encode(), signed, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode("ascii")
        if len(provided) == len(expected) and hmac.compare_digest(
            provided.encode(), expected.encode()
        ):
            return True
    return False
