from rest_framework import status, viewsets

from apps.accounts.permissions import HasRBACPermission, IsSuperAdmin
from apps.core.responses import error_response, success_response
from apps.organization.models import BankHoliday
from apps.organization.serializers import BankHolidaySerializer


class BankHolidayViewSet(viewsets.ModelViewSet):
    serializer_class = BankHolidaySerializer
    permission_classes = [HasRBACPermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "destroy"):
            return [IsSuperAdmin()]
        self.required_permission = "dashboard.view"
        return [HasRBACPermission()]

    def get_queryset(self):
        qs = BankHoliday.objects.all().order_by("-financial_year_start", "holiday_date")
        financial_year = self.request.query_params.get("financial_year")
        if financial_year:
            try:
                qs = qs.filter(financial_year_start=int(financial_year))
            except (TypeError, ValueError):
                pass
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(holiday_name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return success_response(data=serializer.data, message="Bank holidays")

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return success_response(data=serializer.data, message="Bank holiday")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Validation failed",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        instance = serializer.save()
        return success_response(
            data=self.get_serializer(instance).data,
            message="Bank holiday created",
            status_code=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                message="Validation failed",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        instance = serializer.save()
        return success_response(
            data=self.get_serializer(instance).data,
            message="Bank holiday updated",
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return success_response(data=None, message="Bank holiday deleted")
