"""
Signed, expiring URLs for uploaded files (KYC documents, agreements, video KYC).

Uploaded files are never served as a public directory. Every URL that the API
hands out is signed with an HMAC over the file name and an expiry time, and
``signed_media_view`` refuses requests whose signature is missing, wrong, or
expired. Links therefore work only for people who just received them from an
authorised API response, and only for ``MEDIA_URL_TTL_SECONDS``.
"""

from __future__ import annotations

import hashlib
import hmac
import mimetypes
import os
import time
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import FileSystemStorage, default_storage
from django.http import FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_GET

# Expiries are rounded up to this bucket so repeated API calls return the same
# URL for a few minutes (lets the browser cache previews).
_EXPIRY_BUCKET_SECONDS = 300

# Types a browser could execute if rendered inline from the API origin.
_FORCE_DOWNLOAD_TYPES = frozenset(
    {
        "text/html",
        "application/xhtml+xml",
        "image/svg+xml",
        "text/xml",
        "application/xml",
        "text/javascript",
        "application/javascript",
    }
)


def _normalise(name: str) -> str:
    return (name or "").replace("\\", "/").lstrip("/")


def _signature(name: str, expires: int) -> str:
    key = f"{settings.SECRET_KEY}:signed-media-url".encode()
    message = f"{_normalise(name)}:{expires}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def sign_media_name(name: str, *, ttl: int | None = None, now: float | None = None):
    ttl = int(ttl if ttl is not None else settings.MEDIA_URL_TTL_SECONDS)
    current = int(now if now is not None else time.time())
    expires = ((current + ttl) // _EXPIRY_BUCKET_SECONDS + 1) * _EXPIRY_BUCKET_SECONDS
    return expires, _signature(name, expires)


def verify_media_signature(name: str, expires: str, signature: str) -> bool:
    try:
        expires_at = int(expires)
    except (TypeError, ValueError):
        return False
    if expires_at < int(time.time()):
        return False
    expected = _signature(name, expires_at)
    return hmac.compare_digest(expected.encode(), (signature or "").encode())


class SignedMediaStorage(FileSystemStorage):
    """FileSystemStorage whose ``url()`` returns a signed, expiring link."""

    def url(self, name):
        base = super().url(name)
        expires, signature = sign_media_name(name)
        return f"{base}?{urlencode({'expires': expires, 'sig': signature})}"


@xframe_options_exempt
@require_GET
def signed_media_view(request, path: str):
    if not verify_media_signature(path, request.GET.get("expires", ""), request.GET.get("sig", "")):
        raise Http404("File not found.")
    try:
        full_path = default_storage.path(_normalise(path))
    except (SuspiciousFileOperation, NotImplementedError) as exc:
        raise Http404("File not found.") from exc
    if not os.path.isfile(full_path):
        raise Http404("File not found.")

    content_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    as_attachment = content_type in _FORCE_DOWNLOAD_TYPES
    response = FileResponse(
        open(full_path, "rb"),  # noqa: SIM115 - FileResponse closes it
        content_type="application/octet-stream" if as_attachment else content_type,
        as_attachment=as_attachment,
        filename=os.path.basename(full_path),
    )
    response["Cache-Control"] = "private, max-age=300"
    response["X-Content-Type-Options"] = "nosniff"
    response["Referrer-Policy"] = "no-referrer"
    return response
