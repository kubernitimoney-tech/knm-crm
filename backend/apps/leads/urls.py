from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.leads.views.lead_intake_views import (
    PublicLeadIntakeAPIView,
    PublicLeadSourceListAPIView,
    PublicLeadTrackAPIView,
)
from apps.leads.views.lead_pipeline_views import AssignmentRosterAPIView, LeadPipelineAPIView
from apps.leads.views.lead_views import CustomerLookupAPIView, LeadSourceListAPIView, LeadViewSet

router = DefaultRouter()
router.register("", LeadViewSet, basename="lead")

urlpatterns = [
    path("intake/", PublicLeadIntakeAPIView.as_view(), name="lead-public-intake"),
    path(
        "intake/sources/", PublicLeadSourceListAPIView.as_view(), name="lead-public-intake-sources"
    ),
    path("intake/track/", PublicLeadTrackAPIView.as_view(), name="lead-public-track"),
    path("customer-lookup/", CustomerLookupAPIView.as_view(), name="lead-customer-lookup"),
    path("sources/", LeadSourceListAPIView.as_view(), name="lead-sources"),
    path("pipeline/", LeadPipelineAPIView.as_view(), name="lead-pipeline"),
    path("assignment-roster/", AssignmentRosterAPIView.as_view(), name="lead-assignment-roster"),
    path("", include(router.urls)),
]
