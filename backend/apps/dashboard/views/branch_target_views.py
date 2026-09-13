from rest_framework import status, viewsets

from apps.accounts.permissions import HasRBACPermission, IsSuperAdmin
from apps.core.responses import error_response, success_response
from apps.dashboard.models import BranchSanctionTarget
from apps.dashboard.serializers import BranchSanctionTargetSerializer


class BranchSanctionTargetViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSanctionTargetSerializer
    permission_classes = [HasRBACPermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "destroy"):
            return [IsSuperAdmin()]
        self.required_permission = "dashboard.view"
        return [HasRBACPermission()]

    def get_queryset(self):
        return BranchSanctionTarget.objects.select_related("branch").order_by(
            "-period_year",
            "-period_month",
            "branch__branch_name",
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(branch__branch_name__icontains=search)
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data=serializer.data, message="Branch targets")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return success_response(data=serializer.data, message="Branch target")

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
            message="Branch target created",
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
            data=self.get_serializer(instance).data, message="Branch target updated"
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return success_response(data=None, message="Branch target deleted")
