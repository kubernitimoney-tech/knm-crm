"""Mask personal data shown on public (unauthenticated) pages."""

from __future__ import annotations


def mask_mobile(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) < 4:
        return ""
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


def mask_email(value: str) -> str:
    email = (value or "").strip()
    if "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    host, dot, tld = domain.rpartition(".")
    masked_domain = f"{host[:1]}***{dot}{tld}" if host else domain
    visible = local[:1] or "*"
    return f"{visible}***@{masked_domain}"


def mask_name(value: str) -> str:
    parts = [part for part in str(value or "").split() if part]
    return " ".join(f"{part[0]}{'*' * max(len(part) - 1, 2)}" for part in parts)
