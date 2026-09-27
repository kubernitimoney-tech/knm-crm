import logging
import time
from decimal import Decimal, InvalidOperation

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.integrations.cashfree.orders import (
    CashfreeOrderError,
    create_order,
    fetch_order,
    fetch_successful_payment,
)
from apps.repayments.services.online_repayment_service import (
    find_cash_pending_loan,
    loan_lookup_payload,
    payable_amount,
    record_online_payment,
)

logger = logging.getLogger(__name__)


class PublicLoanRepaymentLookupAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        mobile = str(request.data.get("mobile") or "")
        loan = find_cash_pending_loan(mobile)
        if loan is None:
            return error_response(
                message="No active loan was found for this mobile number.",
                status_code=404,
            )
        return success_response(data=loan_lookup_payload(loan))


class PublicLoanRepaymentCheckoutAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        mobile = str(request.data.get("mobile") or "")
        loan = find_cash_pending_loan(mobile)
        if loan is None:
            return error_response(
                message="No active loan was found for this mobile number.",
                status_code=404,
            )
        amount = payable_amount(loan)
        if amount <= 0:
            return error_response(message="This loan has nothing due to pay.", status_code=400)

        customer = loan.customer
        order_id = f"rp-{loan.id.hex[:20]}-{int(time.time())}"
        return_url = f"{settings.PUBLIC_SITE_URL.rstrip('/')}/loan-repayment?order_id={{order_id}}"
        notify_url = request.build_absolute_uri("/api/v1/webhooks/cashfree")
        try:
            session = create_order(
                order_id=order_id,
                amount=amount,
                customer_id=str(customer.id),
                customer_name=customer.full_name,
                customer_email=customer.email,
                customer_phone=customer.mobile_number,
                return_url=return_url,
                notify_url=notify_url,
                loan_id=str(loan.id),
            )
        except CashfreeOrderError as exc:
            return error_response(message=str(exc), status_code=502)
        return success_response(
            data={
                **loan_lookup_payload(loan),
                "checkout_url": session["checkout_url"],
                "payment_session_id": session["payment_session_id"],
            }
        )


class PublicLoanRepaymentConfirmAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = str(request.data.get("order_id") or "").strip()
        if not order_id.startswith("rp-"):
            return error_response(message="Unknown payment.", status_code=400)
        try:
            order = fetch_order(order_id)
            payment = fetch_successful_payment(order_id)
        except CashfreeOrderError as exc:
            return error_response(message=str(exc), status_code=502)
        if payment is None:
            return error_response(message="Payment is not successful yet.", status_code=404)
        tags = order.get("order_tags") if isinstance(order.get("order_tags"), dict) else {}
        loan_id = str(tags.get("loan_id") or "").strip()
        try:
            amount = Decimal(str(payment.get("payment_amount") or order.get("order_amount")))
        except (InvalidOperation, TypeError):
            return error_response(message="Payment amount was missing.", status_code=400)
        record_online_payment(
            loan_id=loan_id,
            order_id=order_id,
            amount=amount,
            utr=str(payment.get("cf_payment_id") or ""),
        )
        return success_response(message="Payment received and waiting for approval.")
