from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.dashboard.views.branch_target_views import BranchSanctionTargetViewSet
from apps.dashboard.views.dashboard_views import DashboardAPIView, DashboardTablesAPIView

router = DefaultRouter()
router.register("branch-targets", BranchSanctionTargetViewSet, basename="branch-sanction-target")

urlpatterns = [
    path("", DashboardAPIView.as_view(), name="dashboard"),
    path("tables/", DashboardTablesAPIView.as_view(), name="dashboard-tables"),
    path("", include(router.urls)),
]
