from __future__ import annotations

import base64
import hashlib
import hmac
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def webhook_secret() -> str:
    return (settings.CASHFREE_WEBHOOK_SECRET or settings.CASHFREE_CLIENT_SECRET or "").strip()


def verify_webhook_signature(*, raw_body: bytes, signature: str, timestamp: str) -> bool:
    """
    Cashfree signs ``timestamp + raw body`` with HMAC-SHA256 and sends the
    base64 digest in ``x-webhook-signature``.
    """
    secret = webhook_secret()
    provided = (signature or "").strip()
    signed_at = (timestamp or "").strip()
    if not secret:
        logger.warning("Cashfree webhook accepted without a configured secret")
        return True
    if not provided or not signed_at:
        return False
    digest = hmac.new(secret.encode(), signed_at.encode() + raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("ascii")
    return hmac.compare_digest(provided.encode(), expected.encode())
