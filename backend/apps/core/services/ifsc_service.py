"""Indian bank IFSC lookup via Razorpay's public IFSC API."""

from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from apps.core.validators.india import validate_ifsc

IFSC_API_URL = "https://ifsc.razorpay.com/{ifsc_code}"
REQUEST_TIMEOUT_SECONDS = 8


class IfscLookupError(Exception):
    """Raised when IFSC details cannot be resolved."""


@dataclass(frozen=True)
class IfscDetails:
    ifsc_code: str
    bank_name: str
    branch: str
    city: str
    state: str

    def as_dict(self) -> dict[str, str]:
        return {
            "ifsc_code": self.ifsc_code,
            "bank_name": self.bank_name,
            "branch": self.branch,
            "city": self.city,
            "state": self.state,
        }


def lookup_ifsc(ifsc_code: str) -> IfscDetails:
    normalized = validate_ifsc(ifsc_code, allow_blank=False, field_label="IFSC code")
    request = Request(
        IFSC_API_URL.format(ifsc_code=normalized),
        headers={"Accept": "application/json", "User-Agent": "KubernitiMoney-LMS/1.0"},
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise IfscLookupError("Unable to reach IFSC service") from exc

    if not isinstance(payload, dict):
        raise IfscLookupError("Invalid IFSC service response")

    bank_name = (payload.get("BANK") or "").strip()
    if not bank_name:
        raise IfscLookupError("IFSC not found")

    return IfscDetails(
        ifsc_code=normalized,
        bank_name=bank_name,
        branch=(payload.get("BRANCH") or "").strip(),
        city=(payload.get("CITY") or "").strip(),
        state=(payload.get("STATE") or "").strip(),
    )


def apply_ifsc_bank_details(details: dict) -> dict:
    """Fill bank_name and branch on disbursal details from IFSC lookup."""
    updated = dict(details or {})
    ifsc_code = str(updated.get("ifsc_code") or "").strip()
    if not ifsc_code:
        return updated

    ifsc_details = lookup_ifsc(ifsc_code)
    updated["ifsc_code"] = ifsc_details.ifsc_code
    updated["bank_name"] = ifsc_details.bank_name
    updated["branch"] = ifsc_details.branch
    return updated


def resolve_ifsc_bank_details(ifsc_code: str) -> dict[str, str]:
    """Best-effort IFSC lookup for prefill; returns empty strings when lookup fails."""
    if not str(ifsc_code or "").strip():
        return {"bank_name": "", "branch": ""}
    try:
        details = lookup_ifsc(ifsc_code)
    except IfscLookupError:
        return {"bank_name": "", "branch": ""}
    return {"bank_name": details.bank_name, "branch": details.branch}
