"""Regression tests for signed media URLs, client IP, masking and throttles."""

import time
from types import SimpleNamespace

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import Client, RequestFactory, override_settings

from apps.core.client_ip import get_client_ip
from apps.core.masking import mask_email, mask_mobile, mask_name
from apps.core.media import sign_media_name, verify_media_signature
from apps.core.throttling import PublicLookupThrottle


@pytest.fixture
def stored_file():
    name = default_storage.save("documents/test/security/kyc.pdf", ContentFile(b"%PDF-1.4 x"))
    yield name
    default_storage.delete(name)


def test_storage_url_is_signed(stored_file):
    url = default_storage.url(stored_file)
    assert url.startswith("/media/documents/test/security/")
    assert "expires=" in url and "sig=" in url


def test_signed_media_url_serves_file(stored_file):
    response = Client().get(default_storage.url(stored_file))
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"%PDF-1.4 x"
    assert response["X-Content-Type-Options"] == "nosniff"


def test_unsigned_media_url_is_refused(stored_file):
    assert Client().get(f"/media/{stored_file}").status_code == 404


def test_tampered_or_expired_media_url_is_refused(stored_file):
    expires, signature = sign_media_name(stored_file)
    client = Client()
    other = stored_file.replace("kyc.pdf", "other.pdf")
    assert client.get(f"/media/{other}?expires={expires}&sig={signature}").status_code == 404
    old_expires, old_signature = sign_media_name(stored_file, ttl=0, now=time.time() - 3600)
    assert not verify_media_signature(stored_file, str(old_expires), old_signature)
    response = client.get(f"/media/{stored_file}?expires={old_expires}&sig={old_signature}")
    assert response.status_code == 404


def test_media_path_traversal_is_refused():
    name = "../config/settings/base.py"
    expires, signature = sign_media_name(name)
    response = Client().get(f"/media/{name}?expires={expires}&sig={signature}")
    assert response.status_code == 404


def test_html_uploads_are_downloaded_not_rendered():
    name = default_storage.save("documents/test/security/page.html", ContentFile(b"<script>"))
    try:
        response = Client().get(default_storage.url(name))
        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert response["Content-Disposition"].startswith("attachment")
    finally:
        default_storage.delete(name)


def _request(remote_addr="203.0.113.9", forwarded=None):
    meta = {"REMOTE_ADDR": remote_addr}
    if forwarded:
        meta["HTTP_X_FORWARDED_FOR"] = forwarded
    return RequestFactory().get("/", **meta)


def test_client_ip_ignores_forwarded_header_without_trusted_proxy():
    assert get_client_ip(_request(forwarded="1.2.3.4")) == "203.0.113.9"


def test_client_ip_uses_entry_added_by_trusted_proxy():
    with override_settings(REST_FRAMEWORK={"NUM_PROXIES": 1}):
        request = _request(remote_addr="172.18.0.5", forwarded="1.2.3.4, 198.51.100.7")
        assert get_client_ip(request) == "198.51.100.7"


def test_masking_helpers():
    assert mask_mobile("+91 98765 43210") == "********3210"
    assert mask_email("rahul.kumar@gmail.com") == "r***@g***.com"
    assert mask_name("Rahul Kumar") == "R**** K****"
    assert mask_name("") == ""


def test_public_repayment_lookup_masks_personal_details(monkeypatch):
    from decimal import Decimal

    from apps.repayments.services import online_repayment_service as service

    loan = SimpleNamespace(
        id="loan-uuid",
        loan_account_number="KNM000123456",
        customer=SimpleNamespace(
            full_name="Rahul Kumar",
            mobile_number="9876543210",
            email="rahul@example.com",
        ),
    )
    monkeypatch.setattr(service, "payable_amount", lambda _loan: Decimal("1500"))
    monkeypatch.setattr(
        service.LoanService, "display_loan_account_number", staticmethod(lambda value: value)
    )
    payload = service.loan_lookup_payload(loan)
    assert payload == {
        "loan_no": "********3456",
        "customer_name": "R**** K****",
        "mobile": "******3210",
        "email": "r***@e***.com",
        "payable_amount": "1500.00",
    }


def test_public_repayment_lookup_is_throttled(monkeypatch):
    from django.core.cache import cache

    from apps.repayments.views import public_repayment_views as views

    cache.clear()
    monkeypatch.setattr(views, "find_cash_pending_loan", lambda mobile: None)
    monkeypatch.setattr(PublicLookupThrottle, "THROTTLE_RATES", {"public_lookup": "2/hour"})
    client = Client()
    codes = [
        client.post(
            "/api/v1/leads/public/repayments/lookup/",
            {"mobile": "9876543210"},
            content_type="application/json",
        ).status_code
        for _ in range(3)
    ]
    cache.clear()
    assert codes == [404, 404, 429]
