import re

from django.core.exceptions import ValidationError


class CharacterMixValidator:
    """Require an uppercase letter, a lowercase letter, a digit and a symbol."""

    _RULES = (
        (re.compile(r"[A-Z]"), "an uppercase letter"),
        (re.compile(r"[a-z]"), "a lowercase letter"),
        (re.compile(r"\d"), "a digit"),
        (re.compile(r"[^A-Za-z0-9]"), "a symbol"),
    )

    def validate(self, password, user=None):
        missing = [label for pattern, label in self._RULES if not pattern.search(password or "")]
        if missing:
            raise ValidationError(
                "Password must contain " + ", ".join(missing) + ".",
                code="password_character_mix",
            )

    def get_help_text(self):
        return (
            "Your password must contain an uppercase letter, a lowercase letter, "
            "a digit and a symbol."
        )
