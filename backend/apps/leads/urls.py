from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.leads.views.lead_intake_views import (
    PublicLeadIntakeAPIView,
    PublicLeadSourceListAPIView,
    PublicLeadTrackAPIView,
)
from apps.leads.views.lead_pipeline_views import AssignmentRosterAPIView, LeadPipelineAPIView
from apps.leads.views.lead_views import CustomerLookupAPIView, LeadSourceListAPIView, LeadViewSet
from apps.leads.views.public_esign_views import (
    PublicEsignAPIView,
    PublicEsignDocumentAPIView,
    PublicEsignEmailOtpAPIView,
    PublicEsignOtpAPIView,
    PublicEsignVerifyEmailOtpAPIView,
    PublicEsignVerifyOtpAPIView,
)
from apps.leads.views.public_video_kyc_views import PublicVideoKycAPIView

router = DefaultRouter()
router.register("", LeadViewSet, basename="lead")

urlpatterns = [
    path("intake/", PublicLeadIntakeAPIView.as_view(), name="lead-public-intake"),
    path(
        "intake/sources/", PublicLeadSourceListAPIView.as_view(), name="lead-public-intake-sources"
    ),
    path("intake/track/", PublicLeadTrackAPIView.as_view(), name="lead-public-track"),
    path("esign/<uuid:pk>/", PublicEsignAPIView.as_view(), name="public-esign"),
    path(
        "esign/<uuid:pk>/email-otp/",
        PublicEsignEmailOtpAPIView.as_view(),
        name="public-esign-email-otp",
    ),
    path(
        "esign/<uuid:pk>/verify-email-otp/",
        PublicEsignVerifyEmailOtpAPIView.as_view(),
        name="public-esign-verify-email-otp",
    ),
    path("esign/<uuid:pk>/otp/", PublicEsignOtpAPIView.as_view(), name="public-esign-otp"),
    path(
        "esign/<uuid:pk>/verify-otp/",
        PublicEsignVerifyOtpAPIView.as_view(),
        name="public-esign-verify-otp",
    ),
    path("video-kyc/<uuid:pk>/", PublicVideoKycAPIView.as_view(), name="public-video-kyc"),
    path(
        "esign/<uuid:pk>/document/",
        PublicEsignDocumentAPIView.as_view(),
        name="public-esign-document",
    ),
    path("customer-lookup/", CustomerLookupAPIView.as_view(), name="lead-customer-lookup"),
    path("sources/", LeadSourceListAPIView.as_view(), name="lead-sources"),
    path("pipeline/", LeadPipelineAPIView.as_view(), name="lead-pipeline"),
    path("assignment-roster/", AssignmentRosterAPIView.as_view(), name="lead-assignment-roster"),
    path("", include(router.urls)),
]
