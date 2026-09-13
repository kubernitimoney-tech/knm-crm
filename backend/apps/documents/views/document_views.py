from django.contrib.contenttypes.models import ContentType
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.applications.models import LoanApplication
from apps.core.responses import error_response, success_response
from apps.customers.models import Customer
from apps.documents.models import Document, DocumentType
from apps.documents.serializers.document_serializers import DocumentSerializer
from apps.documents.services.document_service import DocumentService


class DocumentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [HasRBACPermission]
    required_permission = "document.view"

    def _get_application_or_error(self):
        application_pk = self.kwargs.get("application_pk")
        try:
            application = LoanApplication.objects.get(pk=application_pk, is_deleted=False)
        except LoanApplication.DoesNotExist:
            return None, error_response(message="Application not found", status_code=404)
        if not application.check_user_access(self.request.user):
            return None, error_response(message="Application not found", status_code=404)
        return application, None

    def get_queryset(self):
        application, error = self._get_application_or_error()
        if error is not None:
            return Document.objects.none()
        ct = ContentType.objects.get_for_model(LoanApplication)
        return (
            Document.objects.filter(
                content_type=ct,
                object_id=application.id,
            )
            .select_related("document_type", "current_version")
            .prefetch_related("versions")
        )

    def list(self, request, *args, **kwargs):
        _, error = self._get_application_or_error()
        if error is not None:
            return error
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        _, error = self._get_application_or_error()
        if error is not None:
            return error
        return super().retrieve(request, *args, **kwargs)


class UploadDocumentAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "document.upload"

    def post(self, request, application_id):
        try:
            application = LoanApplication.objects.get(pk=application_id, is_deleted=False)
        except LoanApplication.DoesNotExist:
            return error_response(message="Application not found", status_code=404)

        if not application.check_user_access(request.user):
            return error_response(message="Application not found", status_code=404)

        doc_type_code = request.data.get("document_type")
        uploaded_file = request.FILES.get("file")
        if not doc_type_code or not uploaded_file:
            return error_response(message="document_type and file are required")

        try:
            document_type = DocumentType.objects.get(code=doc_type_code)
        except DocumentType.DoesNotExist:
            return error_response(message="Invalid document type")

        version = DocumentService.upload_document(
            user=request.user,
            content_object=application,
            document_type=document_type,
            uploaded_file=uploaded_file,
            title=request.data.get("title", ""),
        )
        return success_response(
            data={"version_id": str(version.id), "file_name": version.file_name},
            message="Document uploaded",
            status_code=status.HTTP_201_CREATED,
        )


class CustomerDocumentUploadAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [HasRBACPermission]
    required_permission = "document.upload"

    def post(self, request, customer_id):
        try:
            customer = Customer.objects.get(pk=customer_id, is_deleted=False)
        except Customer.DoesNotExist:
            return error_response(message="Customer not found", status_code=404)

        doc_type_code = request.data.get("document_type")
        uploaded_file = request.FILES.get("file")
        if not doc_type_code or not uploaded_file:
            return error_response(message="document_type and file are required")

        try:
            document_type = DocumentType.objects.get(code=doc_type_code)
        except DocumentType.DoesNotExist:
            return error_response(message="Invalid document type")

        version = DocumentService.upload_document(
            user=request.user,
            content_object=customer,
            document_type=document_type,
            uploaded_file=uploaded_file,
            title=request.data.get("title", ""),
        )
        return success_response(
            data={"version_id": str(version.id), "file_name": version.file_name},
            message="Document uploaded",
            status_code=status.HTTP_201_CREATED,
        )
