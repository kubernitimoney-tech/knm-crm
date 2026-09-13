from rest_framework import viewsets
from rest_framework.decorators import action

from apps.accounts.permissions import HasRBACPermission
from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.accounts.services.role_helpers import is_super_admin
from apps.core.responses import error_response, success_response
from apps.customers.models import Customer
from apps.customers.selectors.customer_selectors import (
    get_customer_list_queryset,
    get_customer_profile,
)
from apps.customers.serializers import (
    CustomerCreateSerializer,
    CustomerProfileSerializer,
    CustomerProfileUpdateSerializer,
    CustomerSerializer,
)
from apps.customers.services.customer_service import CustomerService


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [HasRBACPermission]
    search_fields = ["customer_code", "first_name", "last_name", "email", "mobile_number"]
    filterset_fields = ["gender", "status"]

    def get_serializer_class(self):
        if self.action == "create":
            return CustomerCreateSerializer
        return CustomerSerializer

    def get_queryset(self):
        if self.action == "list":
            return get_customer_list_queryset()
        return Customer.objects.prefetch_related("identities").select_related(
            "created_by", "updated_by"
        )

    def get_permissions(self):
        perms = {
            "list": "customer.view",
            "retrieve": "customer.view",
            "create": "customer.create",
            "update": "customer.update",
            "partial_update": "customer.update",
            "destroy": "customer.delete",
        }
        if self.action == "profile":
            if self.request.method == "PATCH":
                self.required_permission = "customer.update"
                self.required_permissions = None
            else:
                self.required_permissions = [
                    "customer.view",
                    "lead.view",
                    "disbursal.view",
                    "loan.view",
                    "report.view",
                ]
                self.required_permission = None
        else:
            self.required_permission = perms.get(self.action, "customer.view")
            self.required_permissions = None
        return super().get_permissions()

    def _can_view_customer_profile(self, request, customer_id, focus_lead_id=None) -> bool:
        if request.user.is_superuser:
            return True
        user_perms = resolve_user_permissions(request.user)
        if "customer.view" in user_perms:
            return True
        if any(
            code in user_perms
            for code in (
                "disbursal.view",
                "loan.view",
                "report.view",
                "lead.view",
                "application.view",
            )
        ):
            from apps.accounts.services.role_helpers import is_account_finance
            from apps.applications.constants import FINANCE_VISIBLE_STATUSES
            from apps.applications.models import LoanApplication
            from apps.leads.services.lead_service import LeadService

            if is_account_finance(request.user):
                apps = LoanApplication.objects.filter(
                    customer_id=customer_id,
                    is_deleted=False,
                    status__in=FINANCE_VISIBLE_STATUSES,
                )
                if focus_lead_id:
                    apps = apps.filter(lead_id=focus_lead_id)
                if apps.exists():
                    return True

            visible = LeadService.visible_leads_for(request.user).filter(customer_id=customer_id)
            if focus_lead_id:
                visible = visible.filter(pk=focus_lead_id)
            if visible.exists():
                return True
        if "lead.view" not in user_perms:
            return False
        from apps.leads.services.lead_service import LeadService

        visible = LeadService.visible_leads_for(request.user).filter(customer_id=customer_id)
        if focus_lead_id:
            visible = visible.filter(pk=focus_lead_id)
        return visible.exists()

    @action(detail=True, methods=["get", "patch"], url_path="profile")
    def profile(self, request, pk=None):
        focus_lead_id = request.query_params.get("lead")

        if request.method == "PATCH":
            if not is_super_admin(request.user):
                return error_response(
                    message="Only Super Admin can update customer profile",
                    status_code=403,
                )
            try:
                customer = Customer.objects.get(pk=pk, is_deleted=False)
            except Customer.DoesNotExist:
                return error_response(message="Customer not found", status_code=404)

            serializer = CustomerProfileUpdateSerializer(data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            CustomerService.update_customer_profile(
                user=request.user,
                customer=customer,
                data=serializer.validated_data,
            )
            payload = get_customer_profile(
                customer_id=pk,
                user=request.user,
                focus_lead_id=focus_lead_id,
            )
            return success_response(
                data=CustomerProfileSerializer(payload).data,
                message="Customer profile updated",
            )

        if not self._can_view_customer_profile(request, pk, focus_lead_id):
            return error_response(message="Customer not found", status_code=404)
        try:
            payload = get_customer_profile(
                customer_id=pk,
                user=request.user,
                focus_lead_id=focus_lead_id,
            )
        except Customer.DoesNotExist:
            return error_response(message="Customer not found", status_code=404)

        serializer = CustomerProfileSerializer(payload)
        return success_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = CustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = CustomerService.create_customer(
            user=request.user,
            data=serializer.validated_data,
        )
        return success_response(
            data=CustomerSerializer(customer).data,
            message="Customer created",
            status_code=201,
        )

    def perform_update(self, serializer):
        CustomerService.update_customer(
            user=self.request.user,
            customer=self.get_object(),
            data=serializer.validated_data,
        )

    def perform_destroy(self, instance):
        instance.delete(user=self.request.user)
