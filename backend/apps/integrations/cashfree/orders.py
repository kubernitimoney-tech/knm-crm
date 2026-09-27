from __future__ import annotations

import json
import logging
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class CashfreeOrderError(Exception):
    pass


def cashfree_is_production() -> bool:
    env_name = (getattr(settings, "CASHFREE_ENV", "") or "").strip().lower()
    if env_name in {"production", "prod", "live"}:
        return True
    if env_name in {"sandbox", "test"}:
        return False
    secret = (settings.CASHFREE_CLIENT_SECRET or "").strip()
    return secret.startswith("cfsk_ma_prod_")


def _api_base() -> str:
    if cashfree_is_production():
        return "https://api.cashfree.com/pg"
    return "https://sandbox.cashfree.com/pg"


def checkout_url(payment_session_id: str) -> str:
    host = (
        "https://payments.cashfree.com"
        if cashfree_is_production()
        else "https://sandbox.cashfree.com"
    )
    return f"{host}/pg/view/sessions/checkout?payment_session_id={payment_session_id}"


def fetch_order(order_id: str) -> dict:
    client_id = (settings.CASHFREE_CLIENT_ID or "").strip()
    client_secret = (settings.CASHFREE_CLIENT_SECRET or "").strip()
    if not client_id or not client_secret:
        raise CashfreeOrderError("Cashfree client id and client secret are not configured.")
    request = Request(
        f"{_api_base()}/orders/{order_id}",
        headers={
            "x-api-version": "2023-08-01",
            "x-client-id": client_id,
            "x-client-secret": client_secret,
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Cashfree order lookup failed: %s %s", exc.code, detail)
        raise CashfreeOrderError("Cashfree payment status could not be checked.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise CashfreeOrderError("Cashfree payment status could not be checked.") from exc
    if not isinstance(body, dict):
        raise CashfreeOrderError("Cashfree payment status could not be checked.")
    return body


def fetch_successful_payment(order_id: str) -> dict | None:
    client_id = (settings.CASHFREE_CLIENT_ID or "").strip()
    client_secret = (settings.CASHFREE_CLIENT_SECRET or "").strip()
    if not client_id or not client_secret:
        raise CashfreeOrderError("Cashfree client id and client secret are not configured.")
    request = Request(
        f"{_api_base()}/orders/{order_id}/payments",
        headers={
            "x-api-version": "2023-08-01",
            "x-client-id": client_id,
            "x-client-secret": client_secret,
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=30) as response:
            payments = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Cashfree payment lookup failed: %s %s", exc.code, detail)
        raise CashfreeOrderError("Cashfree payment status could not be checked.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise CashfreeOrderError("Cashfree payment status could not be checked.") from exc
    if not isinstance(payments, list):
        return None
    for payment in payments:
        if str(payment.get("payment_status") or "").upper() == "SUCCESS":
            return payment
    return None


def create_order(
    *,
    order_id: str,
    amount: Decimal,
    customer_id: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    return_url: str,
    notify_url: str,
    loan_id: str,
) -> dict:
    client_id = (settings.CASHFREE_CLIENT_ID or "").strip()
    client_secret = (settings.CASHFREE_CLIENT_SECRET or "").strip()
    if not client_id or not client_secret:
        raise CashfreeOrderError("Cashfree client id and client secret are not configured.")

    payload = {
        "order_id": order_id,
        "order_amount": float(amount.quantize(Decimal("0.01"))),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": customer_id[:50],
            "customer_name": customer_name[:100] or "Customer",
            "customer_email": customer_email,
            "customer_phone": customer_phone[-10:],
        },
        "order_meta": {
            "return_url": return_url,
            "notify_url": notify_url,
        },
        "order_tags": {"loan_id": loan_id},
    }
    request = Request(
        f"{_api_base()}/orders",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-version": "2023-08-01",
            "x-client-id": client_id,
            "x-client-secret": client_secret,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Cashfree create order failed: %s %s", exc.code, detail)
        raise CashfreeOrderError("Cashfree could not start the payment.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("Cashfree create order failed: %s", exc)
        raise CashfreeOrderError("Cashfree could not start the payment.") from exc

    session_id = str(body.get("payment_session_id") or "").strip()
    if not session_id:
        raise CashfreeOrderError("Cashfree did not return a payment session.")
    return {
        "order_id": order_id,
        "payment_session_id": session_id,
        "checkout_url": checkout_url(session_id),
    }
