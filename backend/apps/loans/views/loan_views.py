from rest_framework import status, viewsets
from rest_framework.decorators import action

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import error_response, success_response
from apps.ledger.selectors.balance_selectors import get_ledger_statement
from apps.loans.selectors.loan_selectors import visible_loans_for
from apps.loans.serializers.loan_serializers import (
    DisburseLoanSerializer,
    LoanDisbursementSerializer,
    LoanSerializer,
)
from apps.loans.services.loan_service import LoanService, LoanServiceError
from apps.repayments.models import LoanRepayment
from apps.repayments.serializers import (
    LoanRepaymentSerializer,
    RecordRepaymentSerializer,
    UpdateRepaymentSerializer,
)
from apps.repayments.services.repayment_service import RepaymentService, RepaymentServiceError


class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [HasRBACPermission]
    filterset_fields = ["status", "customer", "product", "application"]
    search_fields = ["loan_account_number"]

    def get_queryset(self):
        return visible_loans_for(self.request.user)

    def get_permissions(self):
        perms = {
            "list": "loan.view",
            "retrieve": "loan.view",
            "disburse": "disbursal.create",
            "update_disbursement": "disbursal.create",
            "repayments": "loan.view",
            "record_repayment": "collection.create",
            "update_repayment": "collection.update",
            "delete_repayment": "collection.delete",
            "ledger": "loan.view",
        }
        permission_alternatives = {
            "list": ["loan.view", "disbursal.view", "disbursal.create"],
            "retrieve": ["loan.view", "disbursal.view", "disbursal.create"],
            "disburse": ["disbursal.create", "disbursal.view"],
            "update_disbursement": ["disbursal.update", "disbursal.send", "disbursal.view"],
            "repayments": ["loan.view", "disbursal.view", "collection.view"],
            "update_repayment": ["collection.update", "collection.create"],
            "delete_repayment": ["collection.delete", "collection.create"],
            "ledger": ["loan.view", "disbursal.view"],
        }
        self.required_permissions = permission_alternatives.get(self.action)
        self.required_permission = perms.get(self.action, "loan.view")
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="disburse")
    def disburse(self, request, pk=None):
        loan = self.get_object()
        serializer = DisburseLoanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            disbursement = LoanService.disburse_loan(
                user=request.user,
                loan=loan,
                **serializer.validated_data,
            )
        except LoanServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanDisbursementSerializer(disbursement).data,
            message="Loan disbursed",
        )

    @action(detail=True, methods=["post"], url_path="update-disbursement")
    def update_disbursement(self, request, pk=None):
        loan = self.get_object()
        serializer = DisburseLoanSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            disbursement = LoanService.update_disbursement(
                user=request.user,
                loan=loan,
                **serializer.validated_data,
            )
        except LoanServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanDisbursementSerializer(disbursement).data,
            message="Disbursement updated",
        )

    @action(detail=True, methods=["get"], url_path="repayments")
    def repayments(self, request, pk=None):
        loan = self.get_object()
        reps = LoanRepayment.objects.filter(loan=loan).order_by("-payment_date")
        return success_response(data=LoanRepaymentSerializer(reps, many=True).data)

    @action(detail=True, methods=["post"], url_path="repayments/record")
    def record_repayment(self, request, pk=None):
        loan = self.get_object()
        serializer = RecordRepaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = RepaymentService.record_repayment(
                user=request.user,
                loan=loan,
                amount=serializer.validated_data["amount"],
                payment_mode=serializer.validated_data["payment_mode"],
                utr=serializer.validated_data.get("utr", ""),
                payment_date=serializer.validated_data.get("payment_date"),
                gateway_reference=serializer.validated_data.get("gateway_reference", ""),
                remarks=serializer.validated_data.get("remarks", ""),
                collection_status=serializer.validated_data.get("collection_status"),
            )
        except RepaymentServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        loan.refresh_from_db()
        repayment = result["repayment"]
        return success_response(
            data={
                "repayment": LoanRepaymentSerializer(repayment).data,
                "loan": LoanSerializer(loan).data,
                "collection_status": result["collection_status"],
                "collection_status_display": result["collection_status_display"],
                "amount_due": str(result["amount_due"]),
                "till_date_amount": str(result["till_date_amount"]),
                "total_collected": str(result["total_collected"]),
                "lead_status": result["lead_status"],
                "lead_status_display": result["lead_status_display"],
            },
            message="Repayment recorded",
            status_code=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path=r"repayments/(?P<repayment_id>[^/.]+)/update",
    )
    def update_repayment(self, request, pk=None, repayment_id=None):
        loan = self.get_object()
        serializer = UpdateRepaymentSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = RepaymentService.update_repayment(
                user=request.user,
                loan=loan,
                repayment_id=repayment_id,
                amount=data.get("amount"),
                payment_mode=data.get("payment_mode"),
                utr=data.get("utr"),
                payment_date=data.get("payment_date"),
                gateway_reference=data.get("gateway_reference"),
                remarks=data.get("remarks"),
                collection_status=data.get("collection_status"),
            )
        except RepaymentServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        loan.refresh_from_db()
        repayment = result["repayment"]
        return success_response(
            data={
                "repayment": LoanRepaymentSerializer(repayment).data,
                "loan": LoanSerializer(loan).data,
                "collection_status": result["collection_status"],
                "collection_status_display": result["collection_status_display"],
                "amount_due": str(result["amount_due"]),
                "till_date_amount": str(result["till_date_amount"]),
                "total_collected": str(result["total_collected"]),
                "lead_status": result["lead_status"],
                "lead_status_display": result["lead_status_display"],
            },
            message="Repayment updated",
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"repayments/(?P<repayment_id>[^/.]+)/delete",
    )
    def delete_repayment(self, request, pk=None, repayment_id=None):
        loan = self.get_object()
        try:
            result = RepaymentService.delete_repayment(
                user=request.user,
                loan=loan,
                repayment_id=repayment_id,
            )
        except RepaymentServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        loan.refresh_from_db()
        return success_response(
            data={
                "repayment_id": result["repayment_id"],
                "loan": LoanSerializer(loan).data,
                "collection_status": result["collection_status"],
                "collection_status_display": result["collection_status_display"],
                "amount_due": str(result["amount_due"]),
                "till_date_amount": str(result["till_date_amount"]),
                "total_collected": str(result["total_collected"]),
                "lead_status": result["lead_status"],
                "lead_status_display": result["lead_status_display"],
            },
            message="Repayment deleted",
        )

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        loan = self.get_object()
        entries = get_ledger_statement(loan.id)
        data = [
            {
                "id": str(e.id),
                "transaction_date": e.transaction_date,
                "transaction_type": e.transaction_type,
                "debit_amount": e.debit_amount,
                "credit_amount": e.credit_amount,
                "balance_after": e.balance_after,
                "narration": e.narration,
            }
            for e in entries
        ]
        return success_response(data={"entries": data, "balance": str(loan.outstanding_balance)})
