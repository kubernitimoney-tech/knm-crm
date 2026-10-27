"""
Approval-evidence uploads (approval mail / PDF / screenshot).

Checks the extension, the size and the file's real content, so a renamed
HTML or executable file cannot be stored as "approval.pdf".
"""

from __future__ import annotations

import os
import re

from rest_framework import serializers

APPROVAL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
APPROVAL_ATTACHMENT_EXTENSIONS = (".pdf", ".eml", ".msg", ".png", ".jpg", ".jpeg")
APPROVAL_ATTACHMENT_ACCEPT = ",".join(APPROVAL_ATTACHMENT_EXTENSIONS)

_OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # Outlook .msg (OLE2 compound file)
_SIGNATURES = {
    ".pdf": (b"%PDF-",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".msg": (_OLE_SIGNATURE,),
}
_EML_HEADER = re.compile(
    rb"^(from|to|subject|date|received|return-path|message-id|mime-version|delivered-to)"
    rb"\s*:",
    re.IGNORECASE | re.MULTILINE,
)
_EML_SNIFF_BYTES = 16 * 1024


def _read_head(file, size: int) -> bytes:
    position = file.tell() if hasattr(file, "tell") else None
    try:
        file.seek(0)
        return file.read(size) or b""
    finally:
        if position is not None:
            file.seek(position)


def _looks_like_email(head: bytes) -> bool:
    if b"\x00" in head:
        return False
    if re.search(rb"<\s*(script|html|iframe|svg)\b", head, re.IGNORECASE):
        return False
    return len(_EML_HEADER.findall(head)) >= 2


def validate_approval_attachment(file) -> None:
    """Raise ``serializers.ValidationError`` unless ``file`` is acceptable evidence."""
    if not file:
        raise serializers.ValidationError("Approval attachment is required.")

    name = getattr(file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()
    if ext not in APPROVAL_ATTACHMENT_EXTENSIONS:
        raise serializers.ValidationError("Only PDF, EML, MSG, PNG or JPG files are allowed.")

    size = getattr(file, "size", None) or 0
    if size <= 0:
        raise serializers.ValidationError("The attachment is empty.")
    if size > APPROVAL_ATTACHMENT_MAX_BYTES:
        raise serializers.ValidationError("The attachment must be 5 MB or smaller.")

    if ext == ".eml":
        valid = _looks_like_email(_read_head(file, _EML_SNIFF_BYTES))
    else:
        head = _read_head(file, 16)
        valid = any(head.startswith(signature) for signature in _SIGNATURES[ext])
    if not valid:
        raise serializers.ValidationError(
            f"The file content does not match its {ext[1:].upper()} extension."
        )


def safe_attachment_display_name(name: str) -> str:
    """Original file name for display only: no path parts or control characters."""
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:255] or "attachment"
