"""Convert whole rupee amounts to Indian-English words."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_ONES = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
]
_TENS = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
]


def _two_digits(value: int) -> str:
    if value < 20:
        return _ONES[value]
    tens, ones = divmod(value, 10)
    if ones:
        return f"{_TENS[tens]}-{_ONES[ones]}"
    return _TENS[tens]


def _three_digits(value: int) -> str:
    hundred, rest = divmod(value, 100)
    parts: list[str] = []
    if hundred:
        parts.append(f"{_ONES[hundred]} Hundred")
    if rest:
        parts.append(_two_digits(rest))
    return " ".join(parts)


def indian_amount_in_words(value) -> str:
    """Return title-cased Indian numbering words for a whole-rupee amount."""
    if value in (None, ""):
        return ""
    try:
        amount = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        return ""
    number = int(amount)
    if number < 0:
        return ""
    if number == 0:
        return "Zero"

    crore, number = divmod(number, 10_000_000)
    lakh, number = divmod(number, 100_000)
    thousand, number = divmod(number, 1_000)
    parts: list[str] = []
    if crore:
        parts.append(f"{_three_digits(crore)} Crore")
    if lakh:
        parts.append(f"{_three_digits(lakh)} Lakh")
    if thousand:
        parts.append(f"{_three_digits(thousand)} Thousand")
    if number:
        parts.append(_three_digits(number))
    return " ".join(parts)
