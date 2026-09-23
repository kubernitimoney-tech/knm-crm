from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.documents.views.document_views import DocumentViewSet, UploadDocumentAPIView

router = DefaultRouter()
router.register(
    "applications/<uuid:application_pk>/documents",
    DocumentViewSet,
    basename="loan-document",
)

urlpatterns = [
    path(
        "upload/<uuid:application_id>/",
        UploadDocumentAPIView.as_view(),
        name="document-upload",
    ),
] + router.urls
