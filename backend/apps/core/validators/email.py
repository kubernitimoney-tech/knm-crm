"""Email validation helpers."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent / "data" / "disposable_email_domains.txt"


@lru_cache(maxsize=1)
def disposable_email_domains() -> frozenset[str]:
    domains: set[str] = set()
    for line in _DATA_FILE.read_text(encoding="utf-8").splitlines():
        entry = line.strip().lower()
        if entry and not entry.startswith("#"):
            domains.add(entry)
    return frozenset(domains)


def extract_email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].strip().lower()


def is_disposable_email_domain(domain: str) -> bool:
    normalized = domain.strip().lower().strip(".")
    if not normalized:
        return False
    blocked = disposable_email_domains()
    if normalized in blocked:
        return True
    return any(normalized == suffix or normalized.endswith(f".{suffix}") for suffix in blocked)


def validate_business_email(
    value: str,
    *,
    allow_blank: bool = False,
    field_label: str = "Email",
) -> str:
    normalized = (value or "").strip().lower()
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise ValueError(f"{field_label} must be a valid email address.")
    domain = extract_email_domain(normalized)
    if is_disposable_email_domain(domain):
        raise ValueError(f"{field_label} cannot use a disposable email provider.")
    return normalized
