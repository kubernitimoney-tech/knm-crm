"""India postal pincode lookup via api.postalpincode.in."""

from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from apps.core.validators.india import validate_pincode

PINCODE_API_URL = "https://api.postalpincode.in/pincode/{pincode}"
REQUEST_TIMEOUT_SECONDS = 8


class PincodeLookupError(Exception):
    """Raised when pincode details cannot be resolved."""


@dataclass(frozen=True)
class PincodeDetails:
    pincode: str
    city: str
    state: str

    def as_dict(self) -> dict[str, str]:
        return {
            "pincode": self.pincode,
            "city": self.city,
            "state": self.state,
        }


def _pick_post_office(post_offices: list[dict]) -> dict:
    for entry in post_offices:
        if entry.get("BranchType") == "Head Post Office":
            return entry
    for entry in post_offices:
        if entry.get("DeliveryStatus") == "Delivery":
            return entry
    return post_offices[0]


def lookup_pincode(pincode: str) -> PincodeDetails:
    normalized = validate_pincode(pincode, allow_blank=False, field_label="PIN code")
    request = Request(
        PINCODE_API_URL.format(pincode=normalized),
        headers={"Accept": "application/json", "User-Agent": "KubernitiMoney-LMS/1.0"},
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise PincodeLookupError("Unable to reach pincode service") from exc

    if not isinstance(payload, list) or not payload:
        raise PincodeLookupError("Invalid pincode service response")

    result = payload[0]
    if result.get("Status") != "Success":
        raise PincodeLookupError("Pincode not found")

    post_offices = result.get("PostOffice") or []
    if not post_offices:
        raise PincodeLookupError("Pincode not found")

    selected = _pick_post_office(post_offices)
    city = (selected.get("District") or selected.get("Name") or "").strip()
    state = (selected.get("State") or "").strip()
    if not city or not state:
        raise PincodeLookupError("Incomplete pincode details")

    return PincodeDetails(pincode=normalized, city=city, state=state)
