from urllib.parse import quote

from django.conf import settings

from apps.integrations.digio.client import extract_access_token, extract_entity_id


def customer_identifier(*, customer, recipient_email: str = "") -> str:
    return (recipient_email or customer.email or customer.mobile_number or "").strip()


def build_gateway_url(*, entity_id: str, identifier: str, access_token: str = "") -> str:
    """Digio gateway link. Segment order matches the SDK: requestId, identifier, tokenId."""
    base = settings.DIGIO_GATEWAY_BASE_URL.rstrip("/")
    segments = [quote(entity_id, safe=""), quote(identifier, safe="")]
    if access_token:
        segments.append(quote(access_token, safe=""))
    return f"{base}/#/gateway/login/{'/'.join(segments)}"


def gateway_from_payload(*, payload: dict, identifier: str) -> tuple[str, str, str]:
    entity_id = extract_entity_id(payload)
    access_token = extract_access_token(payload)
    request_url = payload.get("access_token_url") or payload.get("url") or ""
    if not request_url and entity_id:
        request_url = build_gateway_url(
            entity_id=entity_id,
            identifier=identifier,
            access_token=access_token,
        )
    return entity_id, access_token, request_url
