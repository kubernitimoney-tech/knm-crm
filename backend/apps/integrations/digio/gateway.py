from urllib.parse import quote

from django.conf import settings

from apps.integrations.digio.client import extract_access_token, extract_entity_id


def digio_web_sdk() -> dict[str, str]:
    """Official Digio browser SDK. Pass identifier in JS — do not put ``@`` in the hash URL.

    Use the API/gateway hosts, not DIGIO_ENV alone. A sandbox env label with
    api.digio.in / app.digio.in would otherwise load the wrong SDK.
    """
    env_name = (settings.DIGIO_ENV or "").strip().lower()
    api_host = settings.DIGIO_BASE_URL.rstrip("/").lower()
    gateway_host = settings.DIGIO_GATEWAY_BASE_URL.rstrip("/").lower()
    production = (
        env_name in {"production", "prod", "live"}
        or api_host.endswith("://api.digio.in")
        or gateway_host.endswith("://app.digio.in")
    )
    if production:
        return {
            "environment": "production",
            "sdk_url": "https://app.digio.in/sdk/v11/digio.js",
        }
    return {
        "environment": "sandbox",
        "sdk_url": "https://ext.digio.in/sdk/v11/digio.js",
    }


def customer_esign_review_url(esign_id) -> str:
    """LMS page: review Agreement.pdf, then continue to Aadhaar eSign."""
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/sign/{esign_id}"


def customer_video_kyc_url(request_id) -> str:
    """LMS page that launches the Digio KYC workflow through its browser SDK."""
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/verify-kyc/{request_id}"


def customer_identifier(*, customer, recipient_email: str = "") -> str:
    value = (recipient_email or customer.email or customer.mobile_number or "").strip()
    if "@" in value:
        return value.lower()
    return value


def quote_gateway_segment(value: str) -> str:
    """Encode path-unsafe characters but keep ``@`` so Digio can read the email.

    ``quote(..., safe="")`` turns ``user@mail.com`` into ``user%40mail.com``.
    Digio's gateway then reports "Identifier is missing".
    """
    return quote((value or "").strip(), safe="@.+_-")


def build_gateway_url(
    *,
    entity_id: str,
    identifier: str,
    access_token: str = "",
    flow: str = "login",
) -> str:
    """Digio gateway link. Segment order matches the SDK: requestId, identifier, tokenId.

    E-sign uses ``login``; video KYC uses ``ekyc``.
    """
    path = "ekyc" if flow == "ekyc" else "login"
    base = settings.DIGIO_GATEWAY_BASE_URL.rstrip("/")
    segments = [quote_gateway_segment(entity_id), quote_gateway_segment(identifier)]
    if access_token:
        segments.append(quote_gateway_segment(access_token))
    return f"{base}/#/gateway/{path}/{'/'.join(segments)}"


def is_guest_gateway_url(url: str) -> bool:
    """True for Digio guest signing (no Drive login / password)."""
    lowered = (url or "").strip().lower()
    return "/#/gateway/" in lowered and "drive.digio.in" not in lowered


def gateway_from_payload(
    *,
    payload: dict,
    identifier: str,
    flow: str = "login",
) -> tuple[str, str, str]:
    entity_id = extract_entity_id(payload)
    access_token = extract_access_token(payload)
    request_url = str(payload.get("access_token_url") or payload.get("url") or "").strip()
    # Digio often returns drive.digio.in, which asks the customer to log in.
    if entity_id and not is_guest_gateway_url(request_url):
        request_url = build_gateway_url(
            entity_id=entity_id,
            identifier=identifier,
            access_token=access_token,
            flow=flow,
        )
    return entity_id, access_token, request_url
