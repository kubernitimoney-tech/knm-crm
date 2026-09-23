"""Indian regulatory / bureau input validators."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

CIBIL_SCORE_MIN = 300
CIBIL_SCORE_MAX = 900


def validate_indian_cibil_score(
    value, *, required: bool = False, label: str = "CIBIL score"
) -> str | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label} is required.")
        return None

    raw = str(value).strip()
    if not raw.isdigit():
        raise ValueError(
            f"{label} must be a whole number between {CIBIL_SCORE_MIN} and {CIBIL_SCORE_MAX}."
        )

    score = int(raw)
    if score < CIBIL_SCORE_MIN or score > CIBIL_SCORE_MAX:
        raise ValueError(
            f"{label} must be between {CIBIL_SCORE_MIN} and {CIBIL_SCORE_MAX} (Indian CIBIL standard)."
        )
    return raw


def _parse_positive_decimal(value, *, label: str) -> Decimal:
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"{label} must be a positive number.")
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"{label} must be a positive number.") from exc
    if parsed <= 0:
        raise ValueError(f"{label} must be a positive number.")
    return parsed


def validate_sanction_income_limits(
    *,
    approved_amount,
    monthly_income,
    monthly_obligation=None,
) -> None:
    """Loan amount and monthly obligation must be below monthly income."""
    if approved_amount is None:
        return

    amount = _parse_positive_decimal(approved_amount, label="Loan amount")
    income = _parse_positive_decimal(monthly_income, label="Monthly income")

    if amount >= income:
        raise ValueError("Loan amount must be less than monthly income.")

    if monthly_obligation is None or (
        isinstance(monthly_obligation, str) and not monthly_obligation.strip()
    ):
        return

    try:
        obligation = Decimal(str(monthly_obligation).strip())
    except (InvalidOperation, TypeError) as exc:
        raise ValueError("Monthly obligation must be a valid number.") from exc

    if obligation < 0:
        raise ValueError("Monthly obligation cannot be negative.")

    if obligation >= income:
        raise ValueError("Monthly obligation must be less than monthly income.")
