from __future__ import annotations

import base64
import binascii
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
    response = _unwrap_kyc_response(response)
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
    video, selfie = _extract_kyc_media(response)
    if video:
        row.recording_file.save(f"{request_id}.mp4", ContentFile(video), save=False)
    if selfie:
        row.selfie_file.save(f"{request_id}.jpg", ContentFile(selfie), save=False)
    row.save()
    return True


def _unwrap_kyc_response(response: dict) -> dict:
    request_details = response.get("request_details")
    if isinstance(request_details, dict) and any(
        key in request_details for key in ("id", "status", "actions")
    ):
        merged = dict(response)
        merged.update(request_details)
        return merged
    return response


def _walk_dicts(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from _walk_dicts(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _walk_dicts(nested)


def _search_text(value) -> str:
    parts: list[str] = []
    for mapping in _walk_dicts(value):
        for key, nested in mapping.items():
            parts.append(str(key).lower())
            if isinstance(nested, str) and len(nested) < 200:
                parts.append(nested.lower())
    return " ".join(parts)


def _display_details(value, *, limit: int = 30) -> dict[str, str]:
    ignored = {
        "file_base64",
        "subfile_base64",
        "file_id",
        "sub_file_id",
        "additional_file_ids",
    }
    result: dict[str, str] = {}

    def walk(current, prefix: str = "") -> None:
        if len(result) >= limit:
            return
        if isinstance(current, dict):
            for key, nested in current.items():
                clean_key = str(key).strip().lower()
                if clean_key in ignored:
                    continue
                next_prefix = f"{prefix}_{clean_key}".strip("_")
                if isinstance(nested, (dict, list)):
                    walk(nested, next_prefix)
                elif nested not in (None, "") and len(str(nested)) < 500:
                    result[next_prefix] = str(nested)
        elif isinstance(current, list):
            for nested in current:
                walk(nested, prefix)

    walk(value)
    return result


def _identity_details(actions: list[dict], token: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for action in actions:
        if token not in _search_text(action):
            continue
        details = _display_details(
            {
                key: action.get(key)
                for key in (
                    "action_data",
                    "details",
                    "ocr_result",
                    "id_card_data_response",
                    "validation_result",
                    "sub_actions",
                )
                if action.get(key) not in (None, "", [], {})
            }
        )
        result.update(details)
    return result


def _find_geolocation(response: dict) -> dict:
    for mapping in _walk_dicts(response):
        geolocation = mapping.get("geolocation")
        if isinstance(geolocation, dict):
            return geolocation
        if any(key in mapping for key in ("latitude", "longitude")):
            return {
                "latitude": mapping.get("latitude"),
                "longitude": mapping.get("longitude"),
                "address": mapping.get("address") or mapping.get("location") or "",
            }
    return {}


def _map_kyc_session(response: dict) -> dict:
    actions = [action for action in (response.get("actions") or []) if isinstance(action, dict)]
    action_types = {
        str(action.get("type") or action.get("action_type") or "").strip().lower()
        for action in actions
    }
    aadhaar = _identity_details(actions, "aadhaar")
    pan = _identity_details(actions, "pan")
    has_selfie = "selfie" in action_types or any(
        "selfie" in _search_text(action) for action in actions
    )
    has_video = any("video" in action_type for action_type in action_types)
    return {
        "provider": "digio",
        "request_id": response.get("id") or "",
        "workflow_name": response.get("workflow_name") or "",
        "status": response.get("status") or "",
        "ids_found": {
            "video": has_video,
            "selfie": has_selfie,
            "aadhaar": bool(aadhaar) or "aadhaar" in _search_text(actions),
            "pan": bool(pan) or "pan" in _search_text(actions),
        },
        "geolocation": _find_geolocation(response),
        "aadhaar_details": aadhaar,
        "pan_details": pan,
    }


def _decode_media(value) -> bytes:
    if not isinstance(value, str) or not value:
        return b""
    encoded = value.split(",", 1)[-1] if value.startswith("data:") else value
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        return b""


def _extract_kyc_media(response: dict) -> tuple[bytes, bytes]:
    video = _decode_media(response.get("video_file") or response.get("file_data"))
    selfie = _decode_media(response.get("selfie_file") or response.get("selfie"))
    for action in response.get("actions") or []:
        if not isinstance(action, dict):
            continue
        action_type = str(action.get("type") or "").lower()
        media = _decode_media(action.get("file_base64"))
        if not media:
            continue
        if action_type in {"video", "two_way_video"} and not video:
            video = media
        elif action_type in {"selfie", "image"} and not selfie:
            selfie = media
    return video, selfie
