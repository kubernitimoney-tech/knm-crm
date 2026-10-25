import base64
import hashlib
import hmac
import json
from unittest.mock import patch

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


SUCCESS_BODY = json.dumps(
    {
        "type": "PAYMENT_SUCCESS_WEBHOOK",
        "data": {
            "order": {
                "order_id": "rp-forged",
                "order_amount": 99999,
                "order_tags": {"loan_id": "00000000-0000-0000-0000-000000000000"},
            },
            "payment": {"payment_status": "SUCCESS", "payment_amount": 99999},
        },
    }
).encode()


@override_settings(CASHFREE_WEBHOOK_SECRET="", CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_without_secret_records_nothing():
    with patch("apps.integrations.cashfree.views.record_verified_order") as record:
        response = APIClient().generic(
            "POST",
            "/api/v1/webhooks/cashfree",
            data=SUCCESS_BODY,
            content_type="application/json",
        )
    assert response.status_code == status.HTTP_200_OK
    record.assert_not_called()


@override_settings(CASHFREE_WEBHOOK_SECRET=SECRET, CASHFREE_CLIENT_SECRET="")
def test_cashfree_webhook_reverifies_order_with_cashfree():
    with patch("apps.integrations.cashfree.views.record_verified_order") as record:
        response = APIClient().generic(
            "POST",
            "/api/v1/webhooks/cashfree",
            data=SUCCESS_BODY,
            content_type="application/json",
            HTTP_X_WEBHOOK_SIGNATURE=_signature(SUCCESS_BODY),
            HTTP_X_WEBHOOK_TIMESTAMP="1710000000",
        )
    assert response.status_code == status.HTTP_200_OK
    record.assert_called_once_with("rp-forged")


def test_record_verified_order_uses_cashfree_amount_not_webhook_amount():
    from apps.repayments.services import online_repayment_service as service

    order = {"order_amount": 1000, "order_tags": {"loan_id": "loan-1"}}
    payment = {"payment_status": "SUCCESS", "payment_amount": 1023.6, "cf_payment_id": 77}
    with (
        patch("apps.integrations.cashfree.orders.fetch_order", return_value=order),
        patch("apps.integrations.cashfree.orders.fetch_successful_payment", return_value=payment),
        patch.object(service, "record_online_payment") as record,
    ):
        service.record_verified_order("rp-abc")
        assert service.record_verified_order("not-ours") is None
    record.assert_called_once()
    kwargs = record.call_args.kwargs
    assert kwargs["loan_id"] == "loan-1"
    assert str(kwargs["amount"]) == "1000.00"
