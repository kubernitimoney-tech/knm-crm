import json
import logging

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.digio.exceptions import DigioError
from apps.integrations.digio.webhooks import process_webhook_payload, verify_webhook_signature

logger = logging.getLogger(__name__)


class DigioWebhookAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
        signature = request.headers.get("X-Digio-Signature") or request.headers.get(
            "X-Digio-Checksum", ""
        )
        token = request.headers.get("X-Digio-Webhook-Token") or request.query_params.get(
            "token", ""
        )
        if not verify_webhook_signature(raw_body=raw_body, header=signature, token=token):
            logger.warning("Rejected Digio webhook: authentication failed")
            return error_response(message="Invalid Digio webhook signature.", status_code=401)
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            return error_response(message="Invalid Digio webhook payload.", status_code=400)
        if not isinstance(payload, dict):
            return error_response(message="Invalid Digio webhook payload.", status_code=400)
        try:
            result = process_webhook_payload(payload)
        except DigioError:
            logger.exception("Digio webhook processing failed")
            return error_response(message="Digio webhook could not be processed.", status_code=502)
        return success_response(data=result, message="Webhook accepted")
