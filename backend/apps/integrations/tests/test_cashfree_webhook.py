import base64
import hashlib
import hmac

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

SECRET = "test-cashfree-webhook"


def _signature(body: bytes, timestamp: str = "1710000000") -> str:
    digest = hmac.new(SECRET.encode(), timestamp.encode() + body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")


@override_settings(CASHFREE_WEBHOOK_SECRET=SECRET, CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_accepts_signed_post_without_trailing_slash():
    body = b'{"type":"WEBHOOK","data":{"test_object":{"test_key":"webhooks"}}}'
    response = APIClient().generic(
        "POST",
        "/api/v1/webhooks/cashfree",
        data=body,
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE=_signature(body),
        HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
    )
    assert response.status_code == status.HTTP_200_OK


@override_settings(CASHFREE_WEBHOOK_SECRET=SECRET, CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_accepts_trailing_slash():
    body = b"{}"
    response = APIClient().generic(
        "POST",
        reverse("cashfree-webhook"),
        data=body,
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE=_signature(body),
        HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
    )
    assert response.status_code == status.HTTP_200_OK


@override_settings(CASHFREE_WEBHOOK_SECRET=SECRET, CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_rejects_bad_signature():
    response = APIClient().generic(
        "POST",
        "/api/v1/webhooks/cashfree",
        data=b"{}",
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE="not-a-signature",
        HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@override_settings(CASHFREE_WEBHOOK_SECRET="not-the-client-secret", CASHFREE_CLIENT_SECRET=SECRET)
def test_cashfree_webhook_accepts_client_secret_when_webhook_secret_differs():
    body = b"{}"
    response = APIClient().generic(
        "POST",
        "/api/v1/webhooks/cashfree",
        data=body,
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE=_signature(body),
        HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
    )
    assert response.status_code == status.HTTP_200_OK


@override_settings(CASHFREE_WEBHOOK_SECRET="", CASHFREE_CLIENT_SECRET=f'"{SECRET}"')
def test_cashfree_webhook_strips_quotes_around_client_secret():
    body = b"{}"
    response = APIClient().generic(
        "POST",
        "/api/v1/webhooks/cashfree",
        data=body,
        content_type="application/json",
        HTTP_X_WEBHOOK_SIGNATURE=_signature(body),
        HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
    )
    assert response.status_code == status.HTTP_200_OK


@override_settings(CASHFREE_WEBHOOK_SECRET="", CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_accepts_dashboard_test_when_secret_unset():
    response = APIClient().post(
        "/api/v1/webhooks/cashfree",
        data={"type": "WEBHOOK"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
