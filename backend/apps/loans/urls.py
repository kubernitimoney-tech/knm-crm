from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.loans.views.loan_pipeline_views import LoanPipelineAPIView
from apps.loans.views.loan_views import LoanViewSet

router = DefaultRouter()
router.register("", LoanViewSet, basename="loan")

urlpatterns = [
    path("pipeline/", LoanPipelineAPIView.as_view(), name="loan-pipeline"),
    path("", include(router.urls)),
]
