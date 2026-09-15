from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

from django.conf import settings

from apps.integrations.digio.exceptions import DigioAPIError, DigioConfigurationError

logger = logging.getLogger(__name__)


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Keep Basic auth on the original host; Digio HTML login pages are not JSON."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _preview(text: str, limit: int = 180) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"


def _looks_like_html(text: str) -> bool:
    start = (text or "").lstrip().lower()
    return start.startswith("<!doctype") or start.startswith("<html") or "<head" in start[:200]


class DigioClient:
    def __init__(
        self,
        *,
        base_url: str,
        client_id: str,
        client_secret: str,
        timeout: int = 180,
    ):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout = timeout

    @classmethod
    def from_settings(cls) -> DigioClient:
        client_id = (settings.DIGIO_CLIENT_ID or "").strip()
        client_secret = (settings.DIGIO_CLIENT_SECRET or "").strip()
        if not client_id or not client_secret:
            raise DigioConfigurationError(
                "Digio is not configured. Set DIGIO_CLIENT_ID and DIGIO_CLIENT_SECRET."
            )
        base_url = (settings.DIGIO_BASE_URL or "").strip()
        host = (urlparse(base_url).hostname or "").lower()
        if host in {"enterprise.digio.in", "drive.digio.in", "app.digio.in"}:
            raise DigioConfigurationError(
                f"DIGIO_BASE_URL points to the Digio website ({host}), not its REST API. "
                "Use https://api.digio.in for production or "
                "https://ext-api.digio.in for sandbox."
            )
        env_name = (settings.DIGIO_ENV or "").strip().lower()
        if env_name in {"sandbox", "test"} and host == "api.digio.in":
            raise DigioConfigurationError(
                "DIGIO_ENV=sandbox but DIGIO_BASE_URL is the production API. "
                "Use https://ext-api.digio.in with sandbox Client ID/Secret from "
                "https://ext.digio.in, or set DIGIO_ENV=production to use these keys."
            )
        if env_name in {"production", "prod", "live"} and host == "ext-api.digio.in":
            raise DigioConfigurationError(
                "DIGIO_ENV=production but DIGIO_BASE_URL is the sandbox API. "
                "Use https://api.digio.in with production Client ID/Secret."
            )
        return cls(
            base_url=base_url,
            client_id=client_id,
            client_secret=client_secret,
        )

    def request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        *,
        raw: bool = False,
    ) -> Any:
        url = f"{self.base_url}{path}"
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        token = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "User-Agent": "kuberniti-lms-digio",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self._open(request) as response:
                content = response.read()
                status = getattr(response, "status", 200)
                content_type = response.headers.get("Content-Type", "") if response.headers else ""
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            logger.warning("Digio %s %s failed: %s %s", method, path, exc.code, err_body[:500])
            if 300 <= exc.code < 400:
                raise DigioAPIError(
                    (
                        f"Digio redirected the request (HTTP {exc.code}) instead of returning JSON. "
                        "Confirm DIGIO_ENV=sandbox, DIGIO_BASE_URL=https://ext-api.digio.in, and that "
                        "DIGIO_CLIENT_ID / DIGIO_CLIENT_SECRET are sandbox credentials."
                    ),
                    status_code=exc.code,
                    body=err_body,
                ) from exc
            if exc.code == 502 and _looks_like_html(err_body):
                raise DigioAPIError(
                    (
                        "Digio sandbox returned HTTP 502 (Bad Gateway) for /v2/client/document/uploadpdf. "
                        "That usually means production Client ID/Secret were sent to "
                        "https://ext-api.digio.in. Open https://ext.digio.in, copy that sandbox "
                        "Client ID and Secret into backend/.env, then run: "
                        "docker compose up -d --force-recreate django. "
                        "Do not use https://enterprise.digio.in keys for testing."
                    ),
                    status_code=exc.code,
                    body=err_body,
                ) from exc
            raise DigioAPIError(
                _friendly_error(err_body, fallback=f"Digio request failed ({exc.code})."),
                status_code=exc.code,
                body=err_body,
            ) from exc
        except TimeoutError as exc:
            raise DigioAPIError(
                "Digio timed out while sending the agreement. Please try again."
            ) from exc
        except urllib.error.URLError as exc:
            raise DigioAPIError(f"Could not reach Digio: {exc.reason}") from exc

        if raw:
            return content
        if not content:
            return {}
        text = content.decode("utf-8", errors="replace")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.warning(
                "Digio %s %s returned non-JSON (%s %s): %s",
                method,
                path,
                status,
                content_type,
                text[:500],
            )
            if _looks_like_html(text):
                raise DigioAPIError(
                    (
                        "Digio returned a web page instead of JSON. Use sandbox API "
                        "https://ext-api.digio.in with sandbox client id/secret (not the website "
                        "https://ext.digio.in), then recreate Django "
                        "(docker compose up -d --force-recreate django)."
                    ),
                    status_code=status,
                    body=text,
                ) from exc
            raise DigioAPIError(
                f"Digio returned a non-JSON response (HTTP {status}): {_preview(text)}",
                status_code=status,
                body=text,
            ) from exc

    def _open(self, request):
        opener = urllib.request.build_opener(_NoRedirectHandler)
        return opener.open(request, timeout=self.timeout)

    def upload_pdf(
        self,
        *,
        file_name: str,
        file_bytes: bytes,
        signer_name: str,
        identifier: str,
        sign_type: str,
        expire_in_days: int = 10,
        redirect_url: str = "",
        reason: str = "Loan Agreement",
    ) -> dict:
        payload = {
            "file_name": file_name,
            "file_data": base64.b64encode(file_bytes).decode("ascii"),
            "expire_in_days": expire_in_days,
            # Digio's own mail opens drive.digio.in and asks for a Digio login.
            # We email the LMS /sign/ page instead.
            "notify_signers": False,
            "generate_access_token": True,
            "signers": [
                {
                    "identifier": identifier,
                    "name": signer_name,
                    "sign_type": sign_type,
                    "reason": reason,
                }
            ],
        }
        if redirect_url:
            payload["redirect_url"] = redirect_url
        return self.request(
            "POST",
            "/v2/client/document/uploadpdf",
            payload,
        )

    def get_document(self, document_id: str) -> dict:
        return self.request("GET", f"/v2/client/document/{document_id}")

    def download_document(self, document_id: str) -> bytes:
        content = self.request("GET", f"/v2/client/document/download/{document_id}", raw=True)
        if isinstance(content, dict):
            encoded = content.get("file_data") or content.get("document")
            if encoded:
                return base64.b64decode(encoded)
            raise DigioAPIError("Digio download did not include a document.")
        text = content[:32]
        if text.lstrip().startswith(b"{") or text.lstrip().startswith(b'"'):
            try:
                parsed = json.loads(content.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return content
            encoded = parsed.get("file_data") or parsed.get("document")
            if encoded:
                return base64.b64decode(encoded)
        return content

    def create_kyc_request(
        self,
        *,
        customer_identifier: str,
        customer_name: str,
        template_name: str,
        reference_id: str,
    ) -> dict:
        transaction_id = reference_id.replace("-", "")
        return self.request(
            "POST",
            "/client/kyc/v2/request/with_template",
            {
                "customer_identifier": customer_identifier,
                "customer_name": customer_name,
                "template_name": template_name,
                "notify_customer": True,
                # No GWT token: Digio must show Send code to Mobile, then the security code.
                "generate_access_token": False,
                "reference_id": reference_id,
                "transaction_id": transaction_id,
                "expire_in_days": 10,
            },
        )

    def get_kyc_response(self, request_id: str) -> dict:
        # DigiStudio's detailed-result API is POST, despite being named "Get Details".
        # file_data=true asks Digio to inline recordings/selfies as base64.
        return self.request(
            "POST",
            f"/client/kyc/v2/{request_id}/response?detail_response=true&file_data=true",
        )

    def download_kyc_media(self, file_id: str, request_id: str = "") -> bytes:
        paths = [f"/client/kyc/v2/media/{file_id}"]
        if request_id:
            paths.insert(0, f"/client/kyc/v2/{request_id}/media/{file_id}")
        for path in paths:
            try:
                content = self.request("GET", path, raw=True)
            except DigioAPIError as exc:
                if exc.status_code in {404, 405}:
                    continue
                raise
            if isinstance(content, dict):
                encoded = content.get("file_data") or content.get("file_base64")
                if encoded:
                    return base64.b64decode(encoded)
                continue
            if not content:
                continue
            stripped = content.lstrip()
            if stripped.startswith(b"{") or stripped.startswith(b"<"):
                continue
            return content
        return b""

    def generate_aadhaar_esign_otp(
        self,
        *,
        aadhaar_id: str,
        unique_request_id: str,
        name: str,
        document_id: str = "",
    ) -> dict:
        payload = {
            "unique_request_id": unique_request_id,
            "aadhaar_id": aadhaar_id,
            "name": name,
        }
        if document_id:
            payload["document_id"] = document_id
        return self.request("POST", "/v2/client/aadhaar/esign/otp", payload)

    def complete_aadhaar_esign(
        self,
        *,
        unique_request_id: str,
        otp: str,
        file_name: str,
        file_bytes: bytes,
        document_id: str = "",
    ) -> dict:
        payload = {
            "unique_request_id": unique_request_id,
            "otp": otp,
            "file_name": file_name,
            "file_data": base64.b64encode(file_bytes).decode("ascii"),
        }
        if document_id:
            payload["document_id"] = document_id
        return self.request("POST", "/v2/client/aadhaar/esign", payload)


def extract_entity_id(payload: dict) -> str:
    for key in ("id", "document_id", "kid", "request_id"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def extract_access_token(payload: dict) -> str:
    token = payload.get("access_token")
    if isinstance(token, dict):
        return str(token.get("id") or token.get("token") or "").strip()
    if isinstance(token, str):
        return token.strip()
    return ""


def _friendly_error(body: str, *, fallback: str) -> str:
    if not body:
        return fallback
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(parsed, dict):
        return fallback
    code = str(parsed.get("code") or "").upper()
    env_name = (getattr(settings, "DIGIO_ENV", "") or "").strip().lower()
    if code == "INVALID_API_CREDENTIALS" and env_name not in {"production", "prod", "live"}:
        return (
            "Digio sandbox rejected these API credentials. Open the sandbox dashboard "
            "(https://ext.digio.in), copy that environment's Client ID and Client Secret "
            "into backend/.env, then run: docker compose up -d --force-recreate django. "
            "Production keys do not work on sandbox."
        )
    message = ""
    for key in ("message", "error", "detail"):
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            message = value.strip()
            break
    if "insufficient credit" in message.lower() or "INSUFFICIENT" in code:
        if "aadhaar" in message.lower():
            return (
                "Digio has no Aadhaar eSign credits on this account. Buy Aadhaar eSign credits "
                "in the Digio enterprise dashboard, then retry."
            )
        return f"{message} Add credits in the Digio enterprise dashboard, then retry."
    if "template" in message.lower() and "not found" in message.lower():
        configured = (getattr(settings, "DIGIO_KYC_TEMPLATE_NAME", "") or "").strip()
        return (
            f"Digio has no DigiKYC API template named {configured!r}. "
            "'Agents On Call' is usually an agent-desk label, not the API template_name. "
            "In https://enterprise.digio.in open DigiKYC → Templates (workflow templates used "
            "for the with_template API), copy that Template Name exactly, set "
            "DIGIO_KYC_TEMPLATE_NAME in backend/.env in quotes, then: "
            "docker compose up -d --force-recreate django. "
            "See https://documentation.digio.in/digikyc/agent_assisted_vkyc/integration_guide/"
        )
    reference = parsed.get("details")
    if str(code) == "1024" or "requested resource not found" in message.lower():
        ref = f" ({reference})" if isinstance(reference, str) and reference else ""
        return (
            "Code 1024 means Digio has no /v2/client/aadhaar/esign/otp API. "
            "Send OTP on our page was calling an endpoint that does not exist"
            f"{ref}."
        )
    suffix = " ".join(
        part
        for part in (
            f"Code: {code}." if code else "",
            f"Digio reference: {reference}." if isinstance(reference, str) and reference else "",
        )
        if part
    )
    friendly = message or fallback
    return f"{friendly} {suffix}".strip()
