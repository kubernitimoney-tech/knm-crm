import json
import logging

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.cashfree.webhooks import verify_webhook_signature
from apps.repayments.services.online_repayment_service import (
    payment_success_from_webhook,
    record_online_payment,
)

logger = logging.getLogger(__name__)


class CashfreeWebhookAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
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
                record_online_payment(**success)
        return success_response(message="Webhook accepted")
