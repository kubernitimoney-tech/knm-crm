import json
import logging

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.cashfree.orders import CashfreeOrderError
from apps.integrations.cashfree.webhooks import verify_webhook_signature, webhook_secrets
from apps.repayments.services.online_repayment_service import (
    payment_success_from_webhook,
    record_verified_order,
)

logger = logging.getLogger(__name__)


class CashfreeWebhookAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    # Cashfree retries and bursts from shared IPs; signatures protect this view.
    throttle_classes = []

    def post(self, request):
        raw_body = request.body or b""
        if not webhook_secrets():
            # Lets the Cashfree dashboard save the URL before keys are configured,
            # but nothing in the body is acted on.
            logger.warning("Cashfree webhook ignored: no signing secret configured")
            return success_response(message="Webhook received but not processed.")

        signature = request.headers.get("x-webhook-signature", "")
        timestamp = request.headers.get("x-webhook-timestamp", "")
        if not verify_webhook_signature(
            raw_body=raw_body, signature=signature, timestamp=timestamp
        ):
            logger.warning("Rejected Cashfree webhook: authentication failed")
            return error_response(message="Invalid Cashfree webhook signature.", status_code=401)
        logger.info("Cashfree webhook accepted (%s bytes)", len(raw_body))
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            payload = None
        if isinstance(payload, dict):
            success = payment_success_from_webhook(payload)
            if success:
                # Never trust amounts or loan ids from the webhook body alone:
                # re-read the order and payment from Cashfree before recording.
                try:
                    record_verified_order(success["order_id"])
                except CashfreeOrderError:
                    logger.exception("Cashfree order %s could not be verified", success["order_id"])
                    return error_response(
                        message="Payment could not be verified yet.", status_code=502
                    )
        return success_response(message="Webhook accepted")
