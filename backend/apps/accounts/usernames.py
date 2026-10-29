"""
CRM usernames are derived from the email local part and never typed by hand.

pankaj.yadav@kubernitimoney.com -> pankaj.yadav, then pankaj.yadav1, pankaj.yadav2, ...
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

USERNAME_MAX_LENGTH = 30
# Room left for the numeric suffix added when the base is already taken.
_SUFFIX_ROOM = 4

USERNAME_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$")
_DISALLOWED_CHARS = re.compile(r"[^a-z0-9._]+")
_REPEATED_SEPARATORS = re.compile(r"[._]{2,}")


def validate_username(value: str) -> None:
    if not value or len(value) > USERNAME_MAX_LENGTH or not USERNAME_PATTERN.match(value):
        raise ValidationError(
            "Username must be 1-30 lowercase letters, digits, dots or underscores, "
            "starting and ending with a letter or digit."
        )


def username_base_from_email(email: str) -> str:
    local_part = (email or "").strip().lower().split("@", 1)[0]
    base = _DISALLOWED_CHARS.sub("", local_part)
    base = _REPEATED_SEPARATORS.sub(".", base).strip("._")
    base = base[: USERNAME_MAX_LENGTH - _SUFFIX_ROOM].rstrip("._")
    return base or "user"


def generate_unique_username(email: str, *, exclude_pk=None) -> str:
    from apps.accounts.models import User

    base = username_base_from_email(email)
    taken = User.objects.filter(username__startswith=base)
    if exclude_pk is not None:
        taken = taken.exclude(pk=exclude_pk)
    existing = set(taken.values_list("username", flat=True))

    candidate, suffix = base, 0
    while candidate in existing:
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate
