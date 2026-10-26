from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import logging
import re
import time
import urllib.request
from typing import Any

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.integrations.digio.client import DigioClient, coerce_pdf_bytes
from apps.integrations.digio.exceptions import DigioAPIError, DigioError
from apps.integrations.digio.pdf import apply_completed_signature_marks, signer_from_lead
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
    return any(
        token in (event or "").lower() for token in ("signed", "complete", "approved", "success")
    )


def _document_is_signed(document: dict, *, event: str = "") -> bool:
    if _is_success_event(event):
        return True
    blobs = [
        str(document.get("agreement_status") or ""),
        str(document.get("status") or ""),
        str(document.get("document_status") or ""),
    ]
    for party in document.get("signing_parties") or document.get("signers") or []:
        if isinstance(party, dict):
            blobs.append(str(party.get("status") or ""))
    return _is_success_event(" ".join(blobs))


def _handle_esign(document_id: str, *, event: str) -> bool:
    row = LeadEsignRequest.objects.filter(provider_request_id__iexact=document_id).first()
    if row is None:
        logger.info("Digio e-sign webhook for unknown document %s", document_id)
        return False
    already_signed = row.status == EsignRequestStatus.SIGNED
    if already_signed and row.signed_file:
        from apps.integrations.digio.esign import notify_esign_signed_copy

        notify_esign_signed_copy(row)
        return True
    if _is_failure_event(event) and not already_signed:
        row.status = EsignRequestStatus.EXPIRED
        row.save(update_fields=["status", "updated_at"])
        return True

    client = DigioClient.from_settings()
    try:
        document = client.get_document(document_id, include_file=True)
    except TypeError:
        try:
            document = client.get_document(document_id)
        except DigioError:
            document = {}
    except DigioError:
        document = {}
    if not isinstance(document, dict):
        document = {}
    should_complete = already_signed or _document_is_signed(document, event=event)
    if not should_complete:
        return True

    pdf_bytes = coerce_pdf_bytes(document)
    if not pdf_bytes:
        for attempt in range(3):
            try:
                pdf_bytes = coerce_pdf_bytes(client.download_document(document_id))
            except DigioAPIError:
                logger.exception(
                    "Failed to download Digio signed document %s (attempt %s)",
                    document_id,
                    attempt + 1,
                )
                pdf_bytes = b""
            if pdf_bytes:
                break
            if attempt < 2:
                time.sleep(1)
    if pdf_bytes:
        name, location = signer_from_lead(row.lead)
        pdf_bytes = apply_completed_signature_marks(
            pdf_bytes,
            signer_name=name,
            signer_location=location,
            signed_at=timezone.now(),
        )
        row.signed_file.save(f"{document_id}.pdf", ContentFile(pdf_bytes), save=False)
    row.status = EsignRequestStatus.SIGNED
    if not row.signed_at:
        row.signed_at = timezone.now()
    row.save()
    if row.signed_file:
        from apps.integrations.digio.esign import notify_esign_signed_copy

        notify_esign_signed_copy(row, pdf_bytes=pdf_bytes)
    return True


def refresh_esign_from_provider(row: LeadEsignRequest, *, force: bool = False) -> LeadEsignRequest:
    """After Protean redirects back, copy Digio's completed PDF if the webhook has not arrived yet."""
    provider_id = (row.provider_request_id or "").strip()
    if not provider_id:
        return row
    if row.status == EsignRequestStatus.SIGNED and row.signed_file:
        return row
    event = "doc.signed" if force or row.status == EsignRequestStatus.SIGNED else ""
    try:
        _handle_esign(provider_id, event=event)
    except DigioError:
        logger.exception("Could not refresh e-sign %s from Digio", provider_id)
    row.refresh_from_db()
    return row


def _handle_vkyc(request_id: str, *, event: str, payload: dict) -> bool:
    row = LeadVideoKycRequest.objects.filter(provider_request_id__iexact=request_id).first()
    if row is None:
        logger.info("Digio KYC webhook for unknown request %s", request_id)
        return False
    if _is_failure_event(event) and row.status != VideoKycRequestStatus.COMPLETED:
        row.status = VideoKycRequestStatus.EXPIRED
        details = dict(row.session_details or {})
        details["last_event"] = event
        row.session_details = details
        row.save(update_fields=["status", "session_details", "updated_at"])
        return True
    if row.status == VideoKycRequestStatus.COMPLETED and not _vkyc_needs_refresh(row):
        notify_video_kyc_completed(row)
        return True

    client = DigioClient.from_settings()
    try:
        response = client.get_kyc_response(request_id)
    except DigioError:
        # Use the webhook body only; an event name alone never completes KYC.
        response = payload
    return _apply_kyc_response(row, response=response, client=client, event=event)


def refresh_video_kyc_from_provider(
    row: LeadVideoKycRequest, *, force: bool = False
) -> LeadVideoKycRequest:
    provider_id = (row.provider_request_id or "").strip()
    if not provider_id or row.status == VideoKycRequestStatus.EXPIRED:
        return row
    if not _vkyc_needs_refresh(row) and row.status == VideoKycRequestStatus.COMPLETED:
        notify_video_kyc_completed(row)
        return row
    # ``force`` is accepted for older clients but no longer marks KYC complete:
    # the Digio SDK also calls back when a customer quits after step 1, so the
    # status must come from Digio's record of each step.
    try:
        client = DigioClient.from_settings()
        response = client.get_kyc_response(provider_id)
    except DigioError:
        logger.exception("Could not refresh Video KYC %s from Digio", provider_id)
        return row
    _apply_kyc_response(row, response=response, client=client)
    row.refresh_from_db()
    if row.recording_file:
        details = dict(row.session_details or {})
        details["media_sync_attempted"] = True
        row.session_details = details
        row.save(update_fields=["session_details", "updated_at"])
    elif row.status == VideoKycRequestStatus.COMPLETED:
        logger.warning(
            "Video KYC %s completed without a recording; will retry media download",
            row.provider_request_id or row.pk,
        )
    return row


def _vkyc_needs_refresh(row: LeadVideoKycRequest) -> bool:
    if row.status == VideoKycRequestStatus.EXPIRED:
        return False
    if not row.recording_file:
        return True
    details = row.session_details or {}
    if not row.selfie_file and not details.get("media_sync_attempted"):
        return True
    return False


KYC_PROGRESS_NONE = "none"
KYC_PROGRESS_PARTIAL = "partial"
KYC_PROGRESS_COMPLETED = "completed"
_STEP_DONE_TOKENS = ("success", "approved", "approval_pending", "completed", "complete")


def _step_is_done(status: str) -> bool:
    text = (status or "").strip().lower()
    if not text or "partial" in text:
        return False
    return any(token in text for token in _STEP_DONE_TOKENS)


def _kyc_steps(response: dict) -> list[dict]:
    steps = []
    for action in response.get("actions") or []:
        if not isinstance(action, dict):
            continue
        steps.append(
            {
                "type": str(action.get("type") or action.get("action_type") or "").lower(),
                "status": str(action.get("status") or "").lower(),
            }
        )
    return steps


def _kyc_progress(response: dict, *, event: str = "") -> str:
    """How far the customer got, from Digio's own record of each step.

    COMPLETED only when Digio reports the whole request done (approved /
    approval pending) with no step still open, or every reported step is done.
    PARTIAL when some steps are done (e.g. OTP + DigiLocker) but another, such
    as the video recording, is still pending.
    """
    request_status = " ".join(
        str(response.get(key) or "") for key in ("status", "kyc_status", "request_status")
    ).lower()
    states = [step["status"] for step in _kyc_steps(response) if step["status"]]
    open_steps = [state for state in states if not _step_is_done(state)]
    done_steps = [state for state in states if _step_is_done(state)]
    if _step_is_done(request_status) and not open_steps:
        return KYC_PROGRESS_COMPLETED
    if states and not open_steps:
        return KYC_PROGRESS_COMPLETED
    if done_steps or "partial" in request_status:
        return KYC_PROGRESS_PARTIAL
    # Webhook body unavailable: trust only a request-level event, never a step event.
    if not request_status.strip() and not states:
        name = (event or "").lower()
        if "action" not in name and _step_is_done(name):
            return KYC_PROGRESS_COMPLETED
    return KYC_PROGRESS_NONE


def _kyc_is_completed(response: dict, *, event: str = "") -> bool:
    return _kyc_progress(response, event=event) == KYC_PROGRESS_COMPLETED


def _apply_kyc_response(row, *, response, client, event: str = "") -> bool:
    response = _unwrap_kyc_response(response if isinstance(response, dict) else {})
    kyc_status = str(response.get("status") or response.get("kyc_status") or event).lower()
    progress = _kyc_progress(response, event=event)
    should_complete = (
        row.status == VideoKycRequestStatus.COMPLETED or progress == KYC_PROGRESS_COMPLETED
    )
    if not should_complete:
        details = dict(row.session_details or {})
        details["last_event"] = event
        details["provider_status"] = kyc_status
        details["steps"] = _kyc_steps(response)
        update_fields = ["session_details", "updated_at"]
        if progress == KYC_PROGRESS_PARTIAL:
            # Keep what step 1 verified (Aadhaar/PAN, location) for the CRM.
            mapped = _map_kyc_session(response)
            for key in ("aadhaar_details", "pan_details", "geolocation", "workflow_name"):
                if mapped.get(key):
                    details[key] = mapped[key]
            if row.status in (VideoKycRequestStatus.SENT, VideoKycRequestStatus.PENDING):
                row.status = VideoKycRequestStatus.VIDEO_PENDING
                update_fields.append("status")
        row.session_details = details
        row.save(update_fields=update_fields)
        return True

    previous = dict(row.session_details or {})
    mapped = _map_kyc_session(response)
    mapped["email_sent"] = previous.get("email_sent")
    mapped["sms_sent"] = previous.get("sms_sent")
    mapped["customer_identifier"] = previous.get("customer_identifier")
    mapped["verification_method"] = previous.get("verification_method")
    mapped["workflow_name"] = mapped.get("workflow_name") or previous.get("workflow_name") or ""
    row.session_details = {key: value for key, value in mapped.items() if value is not None}
    request_id = row.provider_request_id or str(response.get("id") or "kyc")
    video, selfie = _extract_kyc_media(response, client=client, request_id=request_id)
    if video and not row.recording_file:
        row.recording_file.save(
            f"{request_id}{_media_extension(video, '.mp4')}",
            ContentFile(video),
            save=False,
        )
    if selfie and not row.selfie_file:
        row.selfie_file.save(
            f"{request_id}{_media_extension(selfie, '.jpg')}",
            ContentFile(selfie),
            save=False,
        )
    ids = dict(row.session_details.get("ids_found") or {})
    ids["video"] = bool(row.recording_file)
    ids["selfie"] = bool(row.selfie_file)
    row.session_details["ids_found"] = ids
    row.status = VideoKycRequestStatus.COMPLETED
    if not row.completed_at:
        row.completed_at = timezone.now()
    row.save()
    notify_video_kyc_completed(row)
    return True


def notify_video_kyc_completed(row: LeadVideoKycRequest) -> None:
    """Email the customer once after Video KYC is marked completed."""
    if row.status != VideoKycRequestStatus.COMPLETED:
        return
    from django.core.cache import cache

    from apps.notifications.services.notification_service import NotificationService

    key = f"video-kyc-completed-email:{row.id}"
    if not cache.add(key, True, timeout=60 * 60 * 24 * 120):
        return
    try:
        NotificationService.send_video_kyc_completed_email(row=row)
    except Exception:
        cache.delete(key)
        logger.exception(
            "Failed to email Video KYC completion for lead %s",
            getattr(getattr(row, "lead", None), "lead_id", row.pk),
        )


def _unwrap_kyc_response(response: dict) -> dict:
    request_details = response.get("request_details")
    if isinstance(request_details, dict) and any(
        key in request_details for key in ("id", "status", "actions")
    ):
        merged = dict(response)
        merged.update(request_details)
        merged.pop("request_details", None)
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


def _geo_number(value):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def normalize_geolocation(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    latitude = raw.get("latitude", raw.get("lat", raw.get("Latitude")))
    longitude = raw.get(
        "longitude",
        raw.get("lng", raw.get("lon", raw.get("long", raw.get("Longitude")))),
    )
    address = (
        raw.get("address")
        or raw.get("location")
        or raw.get("formatted_address")
        or raw.get("geo_address")
        or ""
    )
    if isinstance(address, dict):
        address = address.get("address") or address.get("formatted_address") or ""
    return {
        "latitude": _geo_number(latitude),
        "longitude": _geo_number(longitude),
        "address": str(address).strip(),
    }


def _find_geolocation(response: dict) -> dict:
    empty = {"latitude": None, "longitude": None, "address": ""}
    for mapping in _walk_dicts(response):
        for key in ("geolocation", "geo_location", "geo_tagging", "geotag", "geo_tag"):
            nested = mapping.get(key)
            if isinstance(nested, dict):
                normalized = normalize_geolocation(nested)
                if (
                    normalized["latitude"] is not None
                    or normalized["longitude"] is not None
                    or normalized["address"]
                ):
                    return normalized
        if any(key in mapping for key in ("latitude", "longitude", "lat", "lng", "lon")):
            normalized = normalize_geolocation(mapping)
            if normalized["latitude"] is not None or normalized["longitude"] is not None:
                return normalized
    return empty


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
    if isinstance(value, dict):
        return _decode_media(
            value.get("file_data")
            or value.get("file_base64")
            or value.get("data")
            or value.get("content")
        )
    if isinstance(value, (bytes, bytearray)):
        data = bytes(value)
        stripped = data.lstrip()
        if _media_kind_from_bytes(data) or stripped.startswith(b"%PDF"):
            return data
        if re.fullmatch(rb"[A-Za-z0-9+/=\s]+", data) and len(data) > 24:
            try:
                return _decode_media(data.decode("ascii")) or data
            except UnicodeDecodeError:
                return data
        return data
    if not isinstance(value, str) or not value:
        return b""
    encoded = value.split(",", 1)[-1] if value.startswith("data:") else value
    encoded = "".join(encoded.split())
    pad = len(encoded) % 4
    if pad:
        encoded += "=" * (4 - pad)
    try:
        return base64.b64decode(encoded)
    except (ValueError, binascii.Error):
        return b""


def _media_kind_from_bytes(media: bytes) -> str:
    if media[:3] == b"\xff\xd8\xff" or media[:8] == b"\x89PNG\r\n\x1a\n":
        return "selfie"
    if media[:6] in (b"GIF87a", b"GIF89a"):
        return "selfie"
    if media[:4] == b"RIFF" and b"WEBP" in media[8:16]:
        return "selfie"
    if b"ftyp" in media[:32] or (media[:4] == b"RIFF" and b"AVI " in media[8:16]):
        return "video"
    return ""


def _media_extension(media: bytes, default: str) -> str:
    kind = _media_kind_from_bytes(media)
    if media[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if media[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if kind == "selfie":
        return ".jpg"
    return default


def _classify_action_media(action_type: str, key: str, media: bytes) -> str:
    by_bytes = _media_kind_from_bytes(media)
    if by_bytes:
        return by_bytes
    blob = f"{action_type} {key}".lower()
    if any(token in blob for token in ("video", "vkyc", "two_way", "recording")):
        return "video"
    if any(token in blob for token in ("selfie", "image", "photo", "face")):
        return "selfie"
    return ""


def _assign_media(kind: str, media: bytes, video: bytes, selfie: bytes) -> tuple[bytes, bytes]:
    if not media or media.startswith(b"%PDF"):
        return video, selfie
    resolved = kind or _classify_action_media("", "", media)
    if resolved == "selfie":
        if not selfie:
            return video, media
        return video, selfie
    if resolved == "video" and not video:
        return media, selfie
    return video, selfie


def _download_kyc_file(client, file_id: str, request_id: str) -> bytes:
    if client is None or not file_id:
        return b""
    if file_id.upper().startswith(("KID", "DID")):
        return b""
    downloader = getattr(client, "download_kyc_media", None)
    if not callable(downloader):
        return b""
    try:
        content = downloader(file_id, request_id)
    except TypeError:
        try:
            content = downloader(file_id=file_id, request_id=request_id)
        except Exception:
            logger.exception("Failed to download Digio KYC media %s", file_id)
            return b""
    except Exception:
        logger.exception("Failed to download Digio KYC media %s", file_id)
        return b""
    return bytes(content) if isinstance(content, (bytes, bytearray)) else b""


def _download_media_url(url: str) -> bytes:
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return b""
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "kuberniti-lms-digio"})
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
    except Exception:
        logger.exception("Failed to download KYC media URL")
        return b""
    return content if isinstance(content, (bytes, bytearray)) else b""


def _file_id_candidates(mapping: dict) -> list[str]:
    keys = (
        "file_id",
        "sub_file_id",
        "media_id",
        "video_file_id",
        "selfie_file_id",
        "exec_file_id",
        "document_file_id",
    )
    values = [mapping.get(key) for key in keys]
    extra = mapping.get("additional_file_ids")
    if isinstance(extra, list):
        values.extend(extra)
    for key, nested in mapping.items():
        if str(key).lower().endswith("file_id"):
            values.append(nested)
    found: list[str] = []
    for candidate in values:
        if isinstance(candidate, (int, float)):
            candidate = str(int(candidate))
        if not isinstance(candidate, str):
            continue
        file_id = candidate.strip()
        if not file_id or file_id.startswith(("http://", "https://")):
            continue
        found.append(file_id)
    return found


def _extract_kyc_media(response: dict, *, client=None, request_id: str = "") -> tuple[bytes, bytes]:
    video, selfie = b"", b""
    for key in ("selfie_file", "selfie", "video_file", "file_data"):
        media = _decode_media(response.get(key))
        video, selfie = _assign_media(
            _classify_action_media("", key, media),
            media,
            video,
            selfie,
        )
    request_id = request_id or str(response.get("id") or "").strip()
    url_keys = (
        "file_url",
        "video_url",
        "media_url",
        "recording_url",
        "selfie_url",
        "download_url",
    )

    for mapping in _walk_dicts(response):
        action_type = str(mapping.get("type") or mapping.get("action_type") or "").lower()
        for key in ("file_base64", "file_data", "video_file", "selfie_file", "subfile_base64"):
            media = _decode_media(mapping.get(key))
            video, selfie = _assign_media(
                _classify_action_media(action_type, key, media),
                media,
                video,
                selfie,
            )
        for key in url_keys:
            url = mapping.get(key)
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            media = _download_media_url(url)
            video, selfie = _assign_media(
                _classify_action_media(action_type, key, media),
                media,
                video,
                selfie,
            )

    if client is not None:
        seen: set[str] = set()
        for mapping in _walk_dicts(response):
            action_type = str(mapping.get("type") or mapping.get("action_type") or "").lower()
            for file_id in _file_id_candidates(mapping):
                if file_id in seen:
                    continue
                seen.add(file_id)
                media = _download_kyc_file(client, file_id, request_id)
                video, selfie = _assign_media(
                    _classify_action_media(action_type, "file_id", media),
                    media,
                    video,
                    selfie,
                )
            if video and selfie:
                break
    return video, selfie
