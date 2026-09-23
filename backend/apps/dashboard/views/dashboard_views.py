from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import success_response
from apps.dashboard.services.dashboard_service import DashboardService


class DashboardAPIView(APIView):
    """
    APIView for aggregated analytics — not CRUD.
    Multiple data sources, caching, and permission checks differ from ViewSets.
    """

    permission_classes = [HasRBACPermission]
    required_permission = "dashboard.view"

    def get(self, request):
        data = DashboardService.get_summary()
        return success_response(data=data, message="Dashboard summary")


class DashboardTablesAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "dashboard.view"

    def get(self, request):
        period = request.query_params.get("period", "Current Month")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        data = DashboardService.get_tables(
            period=period,
            date_from=date_from,
            date_to=date_to,
        )
        return success_response(data=data, message="Dashboard tables")
