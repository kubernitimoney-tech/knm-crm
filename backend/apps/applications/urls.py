from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.applications.views.application_pipeline_views import ApplicationPipelineAPIView
from apps.applications.views.application_views import (
    LoanApplicationViewSet,
    ProductListAPIView,
    SanctionFeeCalculateAPIView,
)

router = DefaultRouter()
router.register("applications", LoanApplicationViewSet, basename="application")

urlpatterns = [
    path("products/", ProductListAPIView.as_view(), name="product-list"),
    path("pipeline/", ApplicationPipelineAPIView.as_view(), name="application-pipeline"),
    path(
        "sanction-fees/calculate/",
        SanctionFeeCalculateAPIView.as_view(),
        name="sanction-fee-calculate",
    ),
    path("", include(router.urls)),
]
