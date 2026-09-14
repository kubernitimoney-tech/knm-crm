"""Outbound SMS for Video KYC invitation links."""

from __future__ import annotations

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class SmsError(Exception):
    """Raised when an SMS could not be delivered."""


def indian_mobile(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) >= 12 and digits.startswith("91"):
        digits = digits[-10:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise SmsError("Customer mobile number is not a valid 10-digit Indian number.")
    return digits


class SmsService:
    outbox: list[dict[str, str]] = []

    @classmethod
    def send(cls, *, mobile: str, message: str) -> None:
        number = indian_mobile(mobile)
        text = (message or "").strip()
        if not text:
            raise SmsError("SMS message is empty.")

        provider = (getattr(settings, "SMS_PROVIDER", "") or "").strip().lower()
        if provider in {"console", "dummy"}:
            cls.outbox.append({"mobile": number, "message": text})
            logger.info("SMS console to %s: %s", number, text)
            return

        api_key = (getattr(settings, "SMS_API_KEY", "") or "").strip()
        if not provider or not api_key:
            raise SmsError("SMS is not configured. Set SMS_PROVIDER and SMS_API_KEY.")

        if provider == "fast2sms":
            cls._fast2sms(api_key=api_key, mobile=number, message=text)
            return
        if provider == "msg91":
            cls._msg91(api_key=api_key, mobile=number, message=text)
            return
        raise SmsError(f"Unsupported SMS provider: {provider}")

    @classmethod
    def send_video_kyc_link(cls, *, mobile: str, kyc_url: str, lead_id: str = "") -> None:
        lead_bit = f" ({lead_id})" if lead_id else ""
        cls.send(
            mobile=mobile,
            message=f"Kuberniti Money{lead_bit}: complete Video KYC here {kyc_url}",
        )

    @classmethod
    def _fast2sms(cls, *, api_key: str, mobile: str, message: str) -> None:
        payload = urlencode(
            {
                "route": "q",
                "message": message,
                "language": "english",
                "flash": "0",
                "numbers": mobile,
            }
        ).encode("utf-8")
        request = Request(
            "https://www.fast2sms.com/dev/bulkV2",
            data=payload,
            headers={
                "authorization": api_key,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        cls._read(request)

    @classmethod
    def _msg91(cls, *, api_key: str, mobile: str, message: str) -> None:
        sender = (getattr(settings, "SMS_SENDER_ID", "") or "KNMCRM")[:6]
        payload = urlencode(
            {
                "authkey": api_key,
                "mobiles": f"91{mobile}",
                "message": message,
                "sender": sender,
                "route": "4",
            }
        ).encode("utf-8")
        request = Request(
            "https://api.msg91.com/api/sendhttp.php",
            data=payload,
            method="POST",
        )
        cls._read(request)

    @classmethod
    def _read(cls, request: Request) -> None:
        try:
            with urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
            raise SmsError(f"SMS provider returned {exc.code}: {detail[:200]}") from exc
        except URLError as exc:
            raise SmsError("Could not reach the SMS provider.") from exc
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, dict) and str(parsed.get("return") or parsed.get("type") or "").lower() in {
            "false",
            "error",
        }:
            raise SmsError(str(parsed.get("message") or parsed.get("msg") or body)[:200])
        if isinstance(parsed, dict) and parsed.get("error"):
            raise SmsError(str(parsed.get("error") or body)[:200])
