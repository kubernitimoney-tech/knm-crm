"""Indian banking and KYC field validation helpers."""

import re

# Indian mobile: 10 digits, first digit 6–9 (TRAI allocation).
MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")
IFSC_PATTERN = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
PINCODE_PATTERN = re.compile(r"^\d{6}$")
PAN_PATTERN = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
AADHAAR_PATTERN = re.compile(r"^\d{12}$")
GSTIN_PATTERN = re.compile(r"^[A-Z0-9]{15}$")
# MICR cheque leaf number (India): 6 digits.
CHEQUE_NO_PATTERN = re.compile(r"^\d{6}$")


def _strip_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def normalize_mobile(value: str) -> str:
    digits = _strip_digits(value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def normalize_pincode(value: str) -> str:
    return _strip_digits(value)


def normalize_aadhaar(value: str) -> str:
    return _strip_digits(value)


def normalize_pan(value: str) -> str:
    return (value or "").strip().upper()


def normalize_ifsc(value: str) -> str:
    return (value or "").strip().upper()


def normalize_gstin(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", (value or "").strip()).upper()


def normalize_cheque_number(value: str) -> str:
    return _strip_digits(value)


def validate_mobile(
    value: str, *, allow_blank: bool = False, field_label: str = "Mobile number"
) -> str:
    normalized = normalize_mobile(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not MOBILE_PATTERN.fullmatch(normalized):
        raise ValueError(
            f"{field_label} must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9."
        )
    return normalized


def validate_ifsc(value: str, *, allow_blank: bool = False, field_label: str = "IFSC code") -> str:
    normalized = normalize_ifsc(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not IFSC_PATTERN.fullmatch(normalized):
        raise ValueError(
            f"{field_label} must be 11 characters: 4 bank letters, 0, then 6 alphanumeric (e.g. SBIN0001234)."
        )
    return normalized


def validate_pincode(
    value: str, *, allow_blank: bool = False, field_label: str = "PIN code"
) -> str:
    normalized = normalize_pincode(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not PINCODE_PATTERN.fullmatch(normalized):
        raise ValueError(f"{field_label} must be exactly 6 digits.")
    return normalized


def validate_pan(value: str, *, allow_blank: bool = False, field_label: str = "PAN number") -> str:
    normalized = normalize_pan(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not PAN_PATTERN.fullmatch(normalized):
        raise ValueError(
            f"{field_label} must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)."
        )
    return normalized


def validate_aadhaar(
    value: str, *, allow_blank: bool = False, field_label: str = "Aadhaar number"
) -> str:
    normalized = normalize_aadhaar(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not AADHAAR_PATTERN.fullmatch(normalized):
        raise ValueError(f"{field_label} must be exactly 12 digits.")
    return normalized


def validate_gstin(value: str, *, allow_blank: bool = False, field_label: str = "GSTIN") -> str:
    normalized = normalize_gstin(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if not GSTIN_PATTERN.fullmatch(normalized):
        raise ValueError(f"{field_label} must be exactly 15 alphanumeric characters.")
    return normalized


def validate_cheque_number(
    value: str,
    *,
    allow_blank: bool = False,
    field_label: str = "Cheque number",
) -> str:
    normalized = normalize_cheque_number(value)
    if not normalized:
        if allow_blank:
            return ""
        raise ValueError(f"{field_label} is required.")
    if len(normalized) != 6:
        raise ValueError(f"{field_label} must be exactly 6 digits.")
    if not CHEQUE_NO_PATTERN.fullmatch(normalized):
        raise ValueError(f"{field_label} must be exactly 6 digits.")
    return normalized
