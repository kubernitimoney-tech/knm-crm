from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.accounts.services.role_helpers import user_has_permission
from apps.applications.selectors.application_selectors import visible_applications_for
from apps.applications.serializers.application_serializers import (
    ApplicationCreateSerializer,
    ApplicationDecisionWriteSerializer,
    DisbursalSheetWriteSerializer,
    LoanApplicationSerializer,
    SanctionFeeCalculateSerializer,
)
from apps.applications.services.application_service import (
    ApplicationService,
    ApplicationServiceError,
)
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.core.responses import error_response, success_response
from apps.customers.models import Customer
from apps.loans.serializers.loan_serializers import LoanSerializer
from apps.loans.services.loan_service import LoanService, LoanServiceError
from apps.products.models import LoanProduct, ProcessingFeeType


def _clamp_sanction_pricing_for_user(*, user, application, validated_data: dict) -> dict:
    """Users without application.update must use product-standard ROI and processing fee %."""
    if user_has_permission(user, "application.update"):
        return validated_data
    if validated_data.get("decision") != "approved":
        return validated_data

    product = application.product
    if product is None:
        return validated_data

    data = dict(validated_data)
    data["interest_rate"] = product.interest_rate

    pf_percentage = product.processing_fee_percentage
    if product.processing_fee_type == ProcessingFeeType.PERCENTAGE:
        pf_percentage = product.resolve_pf_percentage()

    details = dict(data.get("sanction_details") or {})
    details["pf_percentage"] = str(pf_percentage)
    data["sanction_details"] = details
    return data


class LoanApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanApplicationSerializer
    permission_classes = [HasRBACPermission]
    filterset_fields = ["status", "customer", "product", "lead"]
    search_fields = ["application_number"]

    def get_queryset(self):
        return visible_applications_for(self.request.user).prefetch_related("decisions")

    def get_permissions(self):
        perms = {
            "list": "application.view",
            "retrieve": "application.view",
            "create_application": "application.create",
            "submit_disbursal_sheet": "disbursal.send",
        }
        permission_alternatives = {
            "list": ["application.view", "disbursal.view", "loan.view"],
            "retrieve": ["application.view", "disbursal.view", "loan.view"],
            "submit_disbursal_sheet": ["disbursal.send", "disbursal.create"],
            "submit": ["application.submit", "application.approve", "application.sanction"],
            "decide": ["application.approve", "application.reject", "application.sanction"],
            "send_sanction_email": ["application.approve", "application.sanction"],
            "create_loan": ["application.sanction", "application.approve", "disbursal.create"],
            "loan": [
                "application.view",
                "application.approve",
                "application.sanction",
                "disbursal.view",
                "disbursal.create",
                "loan.view",
                "collection.view",
            ],
        }
        self.required_permissions = permission_alternatives.get(self.action)
        self.required_permission = perms.get(self.action, "application.view")
        return super().get_permissions()

    @action(detail=False, methods=["post"], url_path="create")
    def create_application(self, request):
        serializer = ApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            customer = Customer.objects.get(id=data["customer_id"], is_deleted=False)
            product = LoanProduct.objects.get(id=data["product_id"], is_active=True)
        except (Customer.DoesNotExist, LoanProduct.DoesNotExist):
            return error_response(message="Customer or product not found", status_code=404)
        application = ApplicationService.create_application(
            user=request.user,
            customer=customer,
            product=product,
            data=data,
        )
        return success_response(
            data=LoanApplicationSerializer(application).data,
            message="Application created",
            status_code=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        application = self.get_object()
        try:
            application = ApplicationService.submit(user=request.user, application=application)
        except ApplicationServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanApplicationSerializer(application).data, message="Submitted"
        )

    @action(detail=True, methods=["post"], url_path="decide")
    def decide(self, request, pk=None):
        application = self.get_object()
        serializer = ApplicationDecisionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision_data = _clamp_sanction_pricing_for_user(
            user=request.user,
            application=application,
            validated_data=serializer.validated_data,
        )
        try:
            application = ApplicationService.decide(
                user=request.user,
                application=application,
                **decision_data,
            )
        except ApplicationServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanApplicationSerializer(application).data, message="Decision recorded"
        )

    @action(detail=True, methods=["post"], url_path="send-sanction-email")
    def send_sanction_email(self, request, pk=None):
        application = self.get_object()
        try:
            ApplicationService.send_sanction_approved_email(
                user=request.user,
                application=application,
            )
        except ApplicationServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(message="Sanction email sent")

    @action(detail=True, methods=["post"], url_path="submit-disbursal-sheet")
    def submit_disbursal_sheet(self, request, pk=None):
        application = self.get_object()
        serializer = DisbursalSheetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application = ApplicationService.submit_disbursal_sheet(
                user=request.user,
                application=application,
                disbursal_details=serializer.validated_data,
            )
        except ApplicationServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanApplicationSerializer(application).data,
            message="Disbursal sheet submitted",
        )

    @action(detail=True, methods=["get"], url_path="loan")
    def loan(self, request, pk=None):
        application = self.get_object()
        loan = getattr(application, "loan", None)
        if loan is None or loan.is_deleted:
            return error_response(message="Loan not found", status_code=404)
        return success_response(data=LoanSerializer(loan).data)

    @action(detail=True, methods=["post"], url_path="create-loan")
    def create_loan(self, request, pk=None):
        application = self.get_object()
        try:
            loan = LoanService.create_from_application(user=request.user, application=application)
        except LoanServiceError as exc:
            if "already exists" in str(exc).lower():
                loan = getattr(application, "loan", None)
                if loan is None or loan.is_deleted:
                    return error_response(message=str(exc), status_code=400)
                return success_response(
                    data=LoanSerializer(loan).data,
                    message="Loan already exists",
                )
            return error_response(message=str(exc), status_code=400)
        return success_response(
            data=LoanSerializer(loan).data,
            message="Loan created",
            status_code=status.HTTP_201_CREATED,
        )


def serialize_loan_product_pricing(product: LoanProduct) -> dict:
    pf_percentage = product.processing_fee_percentage
    if product.processing_fee_type == ProcessingFeeType.PERCENTAGE:
        pf_percentage = product.resolve_pf_percentage()
    return {
        "id": str(product.id),
        "product_code": product.product_code,
        "product_name": product.name,
        "min_amount": product.min_amount,
        "max_amount": product.max_amount,
        "min_tenure": product.min_tenure,
        "max_tenure": product.max_tenure,
        "tenure_unit": product.tenure_unit,
        "interest_rate": product.interest_rate,
        "interest_type": product.interest_type,
        "processing_fee_type": product.processing_fee_type,
        "processing_fee": product.processing_fee,
        "processing_fee_percentage": pf_percentage,
        "gst_percentage": product.gst_percentage,
    }


class ProductListAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "application.view"

    def get(self, request):
        products = LoanProduct.objects.all().order_by("product_code")
        data = [serialize_loan_product_pricing(p) for p in products]
        return success_response(data=data)


class SanctionFeeCalculateAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "application.view"

    def post(self, request):
        serializer = SanctionFeeCalculateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        fees = SanctionFeeService.compute(
            principal_amount=data["principal_amount"],
            pf_percentage=data.get("pf_percentage", 0),
            gst_percentage=data.get("gst_percentage"),
        )
        return success_response(data=fees)
