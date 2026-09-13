from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import re
from typing import Any

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import DigioAPIError, DigioError
from apps.leads.models import (
    EsignRequestStatus,
    LeadEsignRequest,
    LeadVideoKycRequest,
    VideoKycRequestStatus,
)

logger = logging.getLogger(__name__)

_PROVIDER_ID_RE = re.compile(r"\b((?:DID|KID)[A-Z0-9]{8,})\b", re.IGNORECASE)


def verify_webhook_signature(*, raw_body: bytes, header: str = "", token: str = "") -> bool:
    """
    Digio does not publish a single webhook auth scheme, so two are accepted:
    an HMAC-SHA256 signature header, or a shared secret embedded in the
    webhook URL (``?token=``) for dashboards that only accept a plain URL.
    """
    secret = (settings.DIGIO_WEBHOOK_SECRET or settings.DIGIO_CLIENT_SECRET or "").strip()
    signature = (header or "").strip()
    shared_token = (token or "").strip()

    if not secret:
        return bool(settings.DIGIO_WEBHOOK_ALLOW_UNSIGNED)
    if signature:
        return _signature_matches(raw_body=raw_body, signature=signature, secret=secret)
    if shared_token:
        return _constant_time_equals(shared_token, secret)
    return bool(settings.DIGIO_WEBHOOK_ALLOW_UNSIGNED)


def _constant_time_equals(provided: str, expected: str) -> bool:
    # Compare as bytes: hmac.compare_digest rejects str with non-ASCII characters.
    return hmac.compare_digest(
        provided.encode("utf-8", errors="ignore"),
        expected.encode("utf-8", errors="ignore"),
    )


def _signature_matches(*, raw_body: bytes, signature: str, secret: str) -> bool:
    provided = signature
    if provided.lower().startswith("sha256="):
        provided = provided[7:]
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256)
    expected = (
        digest.hexdigest(),
        base64.b64encode(digest.digest()).decode("ascii"),
    )
    return any(_constant_time_equals(provided, candidate) for candidate in expected)


def extract_provider_ids(payload: Any) -> list[str]:
    found: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for nested in value.values():
                walk(nested)
        elif isinstance(value, list):
            for nested in value:
                walk(nested)
        elif isinstance(value, str):
            found.extend(match.group(1).upper() for match in _PROVIDER_ID_RE.finditer(value))

    walk(payload)
    seen: set[str] = set()
    unique: list[str] = []
    for item in found:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def extract_event_name(payload: dict) -> str:
    for key in ("event", "event_type", "type"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return ""


def process_webhook_payload(payload: dict) -> dict:
    event = extract_event_name(payload)
    ids = extract_provider_ids(payload)
    handled = []
    for provider_id in ids:
        if provider_id.startswith("DID"):
            if _handle_esign(provider_id, event=event):
                handled.append(provider_id)
        elif provider_id.startswith("KID"):
            if _handle_vkyc(provider_id, event=event, payload=payload):
                handled.append(provider_id)
    return {"event": event, "handled": handled}


def _is_failure_event(event: str) -> bool:
    return any(token in event for token in ("fail", "reject", "expire", "cancel"))


def _is_success_event(event: str) -> bool:
    return any(token in event for token in ("signed", "complete", "approved", "success"))


def _handle_esign(document_id: str, *, event: str) -> bool:
    row = LeadEsignRequest.objects.filter(provider_request_id__iexact=document_id).first()
    if row is None:
        logger.info("Digio e-sign webhook for unknown document %s", document_id)
        return False
    if row.status == EsignRequestStatus.SIGNED and row.signed_file:
        return True
    if _is_failure_event(event):
        row.status = EsignRequestStatus.EXPIRED
        row.save(update_fields=["status", "updated_at"])
        return True

    client = DigioClient.from_settings()
    try:
        document = client.get_document(document_id)
    except DigioError:
        document = {}
    document_status = str(document.get("agreement_status") or document.get("status") or "").lower()
    should_complete = _is_success_event(event) or document_status in {
        "completed",
        "signed",
        "success",
    }
    if not should_complete:
        return True

    try:
        pdf_bytes = client.download_document(document_id)
    except DigioAPIError:
        logger.exception("Failed to download Digio signed document %s", document_id)
        pdf_bytes = b""
    if pdf_bytes:
        row.signed_file.save(f"{document_id}.pdf", ContentFile(pdf_bytes), save=False)
    row.status = EsignRequestStatus.SIGNED
    row.signed_at = timezone.now()
    row.save()
    return True


def _handle_vkyc(request_id: str, *, event: str, payload: dict) -> bool:
    row = LeadVideoKycRequest.objects.filter(provider_request_id__iexact=request_id).first()
    if row is None:
        logger.info("Digio KYC webhook for unknown request %s", request_id)
        return False
    if row.status == VideoKycRequestStatus.COMPLETED:
        return True
    if _is_failure_event(event):
        row.status = VideoKycRequestStatus.EXPIRED
        details = dict(row.session_details or {})
        details["last_event"] = event
        row.session_details = details
        row.save(update_fields=["status", "session_details", "updated_at"])
        return True

    client = DigioClient.from_settings()
    try:
        response = client.get_kyc_response(request_id)
    except DigioError:
        response = payload
    kyc_status = str(response.get("status") or response.get("kyc_status") or event).lower()
    should_complete = _is_success_event(event) or kyc_status in {
        "approved",
        "completed",
        "success",
    }
    if not should_complete:
        details = dict(row.session_details or {})
        details["last_event"] = event
        details["provider_status"] = kyc_status
        row.session_details = details
        row.save(update_fields=["session_details", "updated_at"])
        return True

    row.session_details = _map_kyc_session(response)
    row.status = VideoKycRequestStatus.COMPLETED
    row.completed_at = timezone.now()
    media = _extract_media_bytes(response)
    if media:
        row.recording_file.save(f"{request_id}.mp4", ContentFile(media), save=False)
    row.save()
    return True


def _map_kyc_session(response: dict) -> dict:
    actions = response.get("actions") if isinstance(response.get("actions"), list) else []
    aadhaar = {}
    pan = {}
    geolocation = {}
    has_video = False
    for action in actions:
        if not isinstance(action, dict):
            continue
        action_type = str(action.get("type") or action.get("action_type") or "").lower()
        details = action.get("details") if isinstance(action.get("details"), dict) else action
        if "aadhaar" in action_type or "aadhaar" in str(action.get("id_type") or "").lower():
            aadhaar = details
        if action_type.endswith("pan") or "pan" in action_type:
            pan = details
        if "video" in action_type or "vkyc" in action_type:
            has_video = True
        geo = details.get("geolocation") if isinstance(details, dict) else None
        if isinstance(geo, dict):
            geolocation = geo
    if isinstance(response.get("geolocation"), dict):
        geolocation = response["geolocation"]
    return {
        "provider": "digio",
        "request_id": response.get("id") or "",
        "status": response.get("status") or "",
        "ids_found": {
            "video": has_video or bool(response.get("video_file") or response.get("video_url")),
            "aadhaar": bool(aadhaar) or bool(response.get("aadhaar")),
            "pan": bool(pan) or bool(response.get("pan")),
        },
        "geolocation": geolocation,
        "aadhaar": aadhaar or response.get("aadhaar") or {},
        "pan": pan or response.get("pan") or {},
    }


def _extract_media_bytes(response: dict) -> bytes:
    encoded = response.get("video_file") or response.get("file_data")
    if isinstance(encoded, str) and encoded:
        try:
            return base64.b64decode(encoded)
        except ValueError:
            return b""
    return b""
