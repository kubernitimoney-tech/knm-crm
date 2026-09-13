from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import error_response, success_response
from apps.core.serializers import BranchSerializer
from apps.core.serializers.bank_serializers import BankSerializer
from apps.core.services.ifsc_service import IfscLookupError, lookup_ifsc
from apps.core.services.pincode_service import PincodeLookupError, lookup_pincode
from apps.core.validators.india import validate_ifsc, validate_pincode
from apps.organization.models import Bank, Branch, BranchStatus


class HealthCheckAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return success_response(data={"status": "healthy"}, message="OK")


class BranchListAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "lead.view"

    def get(self, request):
        branches = Branch.objects.filter(status=BranchStatus.ACTIVE).order_by("branch_name")
        return success_response(data=BranchSerializer(branches, many=True).data)


class BankListAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permissions = ["application.view", "lead.view"]

    def get(self, request):
        banks = Bank.objects.filter(is_active=True).order_by("name")
        return success_response(data=BankSerializer(banks, many=True).data)


class PincodeLookupAPIView(APIView):
    """Resolve Indian pincode to city and state via India Post data."""

    permission_classes = [HasRBACPermission]
    required_permissions = ["customer.view", "lead.view"]

    def get(self, request, pincode: str):
        try:
            validate_pincode(pincode, allow_blank=False, field_label="PIN code")
        except ValueError as exc:
            return error_response(message=str(exc), status_code=400)

        try:
            details = lookup_pincode(pincode)
        except PincodeLookupError as exc:
            return error_response(message=str(exc), status_code=404)

        return success_response(data=details.as_dict())


class IfscLookupAPIView(APIView):
    """Resolve Indian IFSC code to bank details."""

    permission_classes = [HasRBACPermission]
    required_permissions = ["customer.view", "lead.view"]

    def get(self, request, ifsc_code: str):
        try:
            validate_ifsc(ifsc_code, allow_blank=False, field_label="IFSC code")
        except ValueError as exc:
            return error_response(message=str(exc), status_code=400)

        try:
            details = lookup_ifsc(ifsc_code)
        except IfscLookupError as exc:
            return error_response(message=str(exc), status_code=404)

        return success_response(data=details.as_dict())
