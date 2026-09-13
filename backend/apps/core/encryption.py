"""
Field-level encryption helpers for sensitive PII (PAN, Aadhaar, account numbers).

Design:
- Reversible encryption uses Fernet (AES-128-CBC + HMAC) so values can be shown
  back to authorized users. The key is read from settings.FIELD_ENCRYPTION_KEY
  when present, otherwise derived deterministically from SECRET_KEY so local/dev
  setups work without extra configuration.
- For exact-match lookups (e.g. "does this PAN already exist?") we cannot query an
  encrypted column, so we also store a deterministic keyed hash (blind index) via
  blind_hash(). The hash is HMAC-SHA256 over a normalized value, which is safe to
  index and unique-constrain without exposing the plaintext.

Rotate keys by setting a new FIELD_ENCRYPTION_KEY and re-encrypting rows offline;
blind_hash uses SECRET_KEY and must stay stable for lookups to keep working.
"""

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _derive_fernet_key() -> bytes:
    configured = getattr(settings, "FIELD_ENCRYPTION_KEY", "") or ""
    if configured:
        # Allow either a ready-made urlsafe base64 key or arbitrary text.
        try:
            Fernet(configured.encode())
            return configured.encode()
        except (ValueError, TypeError):
            seed = configured.encode()
    else:
        seed = settings.SECRET_KEY.encode()
    digest = hashlib.sha256(seed).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    return Fernet(_derive_fernet_key())


def encrypt(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str | None) -> str | None:
    if token in (None, ""):
        return token
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        # Value was never encrypted (e.g. legacy/plaintext) — return as-is.
        return token


def is_encrypted(token: str | None) -> bool:
    if not token:
        return False
    try:
        _fernet().decrypt(token.encode())
        return True
    except (InvalidToken, ValueError):
        return False


def decrypt_for_display(token: str | None) -> str:
    """Return plaintext for API/UI; unwraps legacy double-encrypted values."""
    if not token:
        return ""
    value = decrypt(token) or ""
    # Recover rows that were encrypted twice before get_prep_value was fixed.
    for _ in range(2):
        if not value or not is_encrypted(value):
            break
        value = decrypt(value) or value
    return value


def encrypt_for_storage(value: str | None) -> str | None:
    """Encrypt once for DB writes that bypass the model field (migrations, .update())."""
    if value in (None, ""):
        return value
    plain = decrypt_for_display(value)
    return encrypt(plain)


def blind_hash(value: str | None) -> str | None:
    """Deterministic keyed hash for unique lookups on encrypted values."""
    if value in (None, ""):
        return None
    normalized = value.strip().upper().encode()
    return hmac.new(settings.SECRET_KEY.encode(), normalized, hashlib.sha256).hexdigest()


class EncryptedCharField(models.TextField):
    """
    Stores text encrypted at rest. Transparently encrypts on save and decrypts
    on load. Backed by TEXT since ciphertext is longer than the plaintext.
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        if is_encrypted(value):
            return value
        return encrypt(value)

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_for_display(value)

    def to_python(self, value):
        return value
