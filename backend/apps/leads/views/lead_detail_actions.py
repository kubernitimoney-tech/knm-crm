import logging

from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser

from apps.accounts.permissions import rbac_any_permission, rbac_permission, require_rbac
from apps.accounts.services.role_helpers import user_has_permission
from apps.applications.models import LoanApplication
from apps.core.responses import error_response, success_response
from apps.core.serializers.status_history_serializers import (
    application_status_history_serializer,
    lead_status_history_serializer,
    loan_status_history_serializer,
)
from apps.core.verification import EntryVerificationStatus, apply_entry_verification_status
from apps.customers.models import Customer, CustomerAddress, CustomerEmployment, CustomerReference
from apps.documents.models import Document
from apps.documents.services.document_service import DocumentService, DocumentTypeNotFoundError
from apps.integrations.digio.esign import create_lead_esign_request
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.vkyc import create_lead_video_kyc_request
from apps.leads.models import (
    EsignRequestStatus,
    LeadEsignRequest,
    LeadVideoKycRequest,
)
from apps.leads.selectors.lead_selectors import get_lead_detail
from apps.leads.serializers import (
    LeadAddressSerializer,
    LeadAddressWriteSerializer,
    LeadCompanySerializer,
    LeadCompanyWriteSerializer,
    LeadDocumentSerializer,
    LeadDocumentUpdateSerializer,
    LeadDocumentWriteSerializer,
    LeadEmploymentSerializer,
    LeadEsignRequestSerializer,
    LeadReferenceSerializer,
    LeadReferenceWriteSerializer,
    LeadVideoKycRequestDetailSerializer,
    LeadVideoKycRequestSerializer,
    LeadWorkspaceSerializer,
)
from apps.leads.services.lead_conversion_service import LeadConversionService
from apps.loans.models import Loan

logger = logging.getLogger(__name__)


class LeadDetailActionsMixin:
    def _serialize(self, serializer, *args, **kwargs):
        kwargs.setdefault("context", {"request": self.request})

        return serializer(*args, **kwargs)

    @staticmethod
    def _customer_documents(customer: Customer):
        content_type = ContentType.objects.get_for_model(Customer)

        return (
            Document.objects.filter(content_type=content_type, object_id=customer.pk)
            .select_related("document_type", "current_version")
            .prefetch_related("versions")
            .order_by("-created_at")
        )

    @staticmethod
    def _customer_document(customer: Customer, document_id):
        return LeadDetailActionsMixin._customer_documents(customer).get(pk=document_id)

    @staticmethod
    def _customer_addresses(customer: Customer, lead=None):
        qs = CustomerAddress.objects.filter(customer=customer).order_by("-created_at")

        if lead is not None:
            qs = qs.filter(models.Q(lead=lead) | models.Q(lead__isnull=True))

        return qs

    @rbac_any_permission("lead.view", "loan.view", "collection.view", "disbursal.view")
    @action(detail=True, methods=["get"], url_path="workspace")
    def workspace(self, request, pk=None):
        lead = get_lead_detail(pk)

        customer = lead.customer

        self._sync_signed_esign_files(lead)

        payload = {
            "lead": lead,
            "customer": customer,
            "addresses": CustomerAddress.objects.filter(customer=customer).order_by("-created_at"),
            "documents": self._customer_documents(customer),
            "companies": CustomerEmployment.objects.filter(customer=customer).order_by(
                "-is_current", "-created_at"
            ),
            "references": CustomerReference.objects.filter(customer=customer).order_by(
                "-created_at"
            ),
            "esign_requests": LeadEsignRequest.objects.filter(lead=lead).select_related(
                "requested_by"
            ),
            "video_kyc_requests": LeadVideoKycRequest.objects.filter(lead=lead).select_related(
                "requested_by"
            ),
            "employments": CustomerEmployment.objects.filter(customer=customer).order_by(
                "-is_current", "-created_at"
            ),
        }

        serializer = self._serialize(LeadWorkspaceSerializer, payload)

        return success_response(data=serializer.data)

    @rbac_any_permission(
        "address.view", "lead.view", "loan.view", "collection.view", "disbursal.view"
    )
    @action(detail=True, methods=["get", "post"], url_path="addresses")
    def addresses(self, request, pk=None):
        lead = self.get_object()

        customer = lead.customer

        if request.method == "GET":
            rows = CustomerAddress.objects.filter(customer=customer).order_by("-created_at")

            return success_response(
                data=self._serialize(LeadAddressSerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="address.create")

        serializer = LeadAddressWriteSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        address = CustomerAddress.objects.create(
            customer=customer,
            lead=lead,
            address_type=data.get("address_type"),
            line1=data["address"],
            city=data["city"],
            state=data["state"],
            pincode=data["pincode"],
            verification_status=data.get("status", EntryVerificationStatus.UNVERIFIED),
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            data=self._serialize(LeadAddressSerializer, address).data,
            message="Address added",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("address.update")
    @action(detail=True, methods=["patch", "delete"], url_path=r"addresses/(?P<address_id>[^/.]+)")
    def address_detail(self, request, pk=None, address_id=None):
        lead = self.get_object()

        customer = lead.customer

        try:
            address = CustomerAddress.objects.get(pk=address_id, customer=customer)

        except CustomerAddress.DoesNotExist:
            return error_response(message="Address not found", status_code=404)

        if request.method == "DELETE":
            require_rbac(self, request, permission="address.delete")

            address.delete()

            return success_response(message="Address deleted")

        serializer = LeadAddressWriteSerializer(data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)

        address = serializer.update(address, serializer.validated_data)

        address.updated_by = request.user

        address.save()

        return success_response(
            data=self._serialize(LeadAddressSerializer, address).data,
            message="Address updated",
        )

    @rbac_any_permission(
        "company.view", "lead.view", "loan.view", "collection.view", "disbursal.view"
    )
    @action(detail=True, methods=["get", "post"], url_path="companies")
    def companies(self, request, pk=None):
        lead = self.get_object()

        customer = lead.customer

        if request.method == "GET":
            rows = CustomerEmployment.objects.filter(customer=customer).order_by(
                "-is_current", "-created_at"
            )

            return success_response(
                data=self._serialize(LeadCompanySerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="company.create")

        serializer = LeadCompanyWriteSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        company = CustomerEmployment.objects.create(
            customer=customer,
            employer_name=data["company_name"],
            designation=data.get("company_address", ""),
            employment_type="salaried",
            is_current=True,
            is_verified=data.get("status") == EntryVerificationStatus.VERIFIED,
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            data=self._serialize(LeadCompanySerializer, company).data,
            message="Company detail added",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("company.update")
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"companies/(?P<company_id>[^/.]+)",
    )
    def company_detail(self, request, pk=None, company_id=None):
        lead = self.get_object()

        customer = lead.customer

        try:
            company = CustomerEmployment.objects.get(pk=company_id, customer=customer)

        except CustomerEmployment.DoesNotExist:
            return error_response(message="Company detail not found", status_code=404)

        if request.method == "DELETE":
            require_rbac(self, request, permission="company.delete")

            company.delete()

            return success_response(message="Company detail deleted")

        serializer = LeadCompanyWriteSerializer(data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        if "company_name" in data:
            company.employer_name = data["company_name"]

        if "company_address" in data:
            company.designation = data["company_address"]

        if "status" in data:
            company.is_verified = data["status"] == EntryVerificationStatus.VERIFIED

        company.updated_by = request.user

        company.save()

        return success_response(
            data=self._serialize(LeadCompanySerializer, company).data,
            message="Company detail updated",
        )

    @rbac_any_permission(
        "reference.view", "lead.view", "loan.view", "collection.view", "disbursal.view"
    )
    @action(detail=True, methods=["get", "post"], url_path="references")
    def references(self, request, pk=None):
        lead = self.get_object()

        customer = lead.customer

        if request.method == "GET":
            rows = CustomerReference.objects.filter(customer=customer).order_by("-created_at")

            return success_response(
                data=self._serialize(LeadReferenceSerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="reference.create")

        serializer = LeadReferenceWriteSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        reference = CustomerReference.objects.create(
            customer=customer,
            lead=lead,
            name=data["reference_name"],
            mobile_number=data["reference_mobile"],
            relation=data["relation"],
            is_verified=False,
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            data=self._serialize(LeadReferenceSerializer, reference).data,
            message="Reference added",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("reference.update")
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"references/(?P<reference_id>[^/.]+)",
    )
    def reference_detail(self, request, pk=None, reference_id=None):
        lead = self.get_object()

        customer = lead.customer

        try:
            reference = CustomerReference.objects.get(pk=reference_id, customer=customer)

        except CustomerReference.DoesNotExist:
            return error_response(message="Reference not found", status_code=404)

        if request.method == "DELETE":
            require_rbac(self, request, permission="reference.delete")

            reference.delete()

            return success_response(message="Reference deleted")

        serializer = LeadReferenceWriteSerializer(data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        if "reference_name" in data:
            reference.name = data["reference_name"]

        if "reference_mobile" in data:
            reference.mobile_number = data["reference_mobile"]

        if "relation" in data:
            reference.relation = data["relation"]

        if "status" in data:
            reference.is_verified = data["status"] == EntryVerificationStatus.VERIFIED

        reference.updated_by = request.user

        reference.save()

        return success_response(
            data=self._serialize(LeadReferenceSerializer, reference).data,
            message="Reference updated",
        )

    @rbac_any_permission(
        "document.view", "lead.view", "loan.view", "collection.view", "disbursal.view"
    )
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="documents",
        parser_classes=[MultiPartParser, FormParser],
    )
    def documents(self, request, pk=None):
        lead = self.get_object()

        customer = lead.customer

        if request.method == "GET":
            rows = self._customer_documents(customer)

            return success_response(
                data=self._serialize(LeadDocumentSerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="document.upload")

        serializer = LeadDocumentWriteSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        try:
            document_type = DocumentService.resolve_document_type(data["document_type"])

        except DocumentTypeNotFoundError:
            return error_response(message="Invalid document type", status_code=400)

        version = DocumentService.upload_document(
            user=request.user,
            content_object=customer,
            document_type=document_type,
            uploaded_file=data["file"],
            title=data["file"].name,
        )

        document = version.document

        document.password = data.get("password", "")
        apply_entry_verification_status(
            document,
            data.get("status", EntryVerificationStatus.UNVERIFIED),
        )

        document.updated_by = request.user

        document.save(
            update_fields=[
                "password",
                "verification_status",
                "is_verified",
                "updated_by",
                "updated_at",
            ]
        )

        LeadConversionService.sync_application_from_customer_documents(
            user=request.user,
            lead=lead,
        )

        return success_response(
            data=self._serialize(LeadDocumentSerializer, document).data,
            message="Document uploaded",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("document.reupload")
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"documents/(?P<document_id>[^/.]+)",
        parser_classes=[MultiPartParser, FormParser],
    )
    def document_detail(self, request, pk=None, document_id=None):
        lead = self.get_object()

        customer = lead.customer

        try:
            document = self._customer_document(customer, document_id)

        except Document.DoesNotExist:
            return error_response(message="Document not found", status_code=404)

        if request.method == "DELETE":
            require_rbac(self, request, permission="document.delete")

            for version in document.versions.all():
                if version.file:
                    version.file.delete(save=False)

            document.delete()

            LeadConversionService.sync_application_from_customer_documents(
                user=request.user,
                lead=lead,
            )

            return success_response(message="Document deleted")

        serializer = LeadDocumentUpdateSerializer(
            data=request.data,
            partial=True,
            context={"document": document},
        )

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        if "document_type" in data:
            try:
                document_type = DocumentService.resolve_document_type(data["document_type"])

            except DocumentTypeNotFoundError:
                return error_response(message="Invalid document type", status_code=400)

            document.document_type = document_type

        if "status" in data:
            if (
                document.verification_status == EntryVerificationStatus.VERIFIED
                and data["status"] != EntryVerificationStatus.VERIFIED
            ):
                return error_response(
                    message="Verified documents cannot be marked unverified or incomplete.",
                    status_code=400,
                )

            apply_entry_verification_status(document, data["status"])

        if "password" in data and "file" not in data:
            document.password = data["password"]

        if "file" in data:
            version = DocumentService.upload_document(
                user=request.user,
                content_object=customer,
                document_type=document.document_type,
                uploaded_file=data["file"],
                title=data["file"].name,
            )

            document = version.document

            if "status" in data:
                apply_entry_verification_status(document, data["status"])

            # Re-upload always resets password; provide a new one or leave blank.
            document.password = data.get("password", "")

            document.updated_by = request.user

            update_fields = ["password", "updated_by", "updated_at"]

            if "status" in data:
                update_fields.extend(["verification_status", "is_verified"])

            document.save(update_fields=update_fields)

        else:
            document.updated_by = request.user

            update_fields = ["updated_by", "updated_at"]

            if "document_type" in data:
                update_fields.append("document_type")

            if "status" in data:
                update_fields.extend(["verification_status", "is_verified"])

            if "password" in data:
                update_fields.append("password")

            document.save(update_fields=update_fields)

        LeadConversionService.sync_application_from_customer_documents(
            user=request.user,
            lead=lead,
        )

        return success_response(
            data=self._serialize(LeadDocumentSerializer, document).data,
            message="Document updated",
        )

    @rbac_permission("document.download")
    @action(
        detail=True,
        methods=["get"],
        url_path=r"documents/(?P<document_id>[^/.]+)/download",
    )
    def document_download(self, request, pk=None, document_id=None):
        lead = self.get_object()

        customer = lead.customer

        try:
            document = self._customer_document(customer, document_id)

        except Document.DoesNotExist:
            return error_response(message="Document not found", status_code=404)

        version = document.current_version or document.versions.order_by("-version_number").first()

        if not version or not version.file:
            return error_response(message="File not found", status_code=404)

        return FileResponse(version.file.open("rb"), as_attachment=True, filename=version.file_name)

    @staticmethod
    def _sync_signed_esign_files(lead):
        from apps.integrations.digio.webhooks import refresh_esign_from_provider

        missing = LeadEsignRequest.objects.filter(
            lead=lead,
            status=EsignRequestStatus.SIGNED,
            signed_file="",
        )
        for row in missing:
            try:
                refresh_esign_from_provider(row)
            except Exception:
                logger.exception("Could not fetch signed e-sign PDF for request %s", row.pk)

    @rbac_permission("lead.view")
    @action(detail=True, methods=["get", "post"], url_path="esign-requests")
    def esign_requests(self, request, pk=None):
        lead = self.get_object()

        if request.method == "GET":
            self._sync_signed_esign_files(lead)
            rows = LeadEsignRequest.objects.filter(lead=lead).select_related("requested_by")

            return success_response(
                data=self._serialize(LeadEsignRequestSerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="lead.convert")

        email = request.data.get("recipient_email") or lead.customer.email

        try:
            row = create_lead_esign_request(
                lead=lead,
                requested_by=request.user,
                recipient_email=email or "",
                sign_type=request.data.get("sign_type") or "",
            )
        except DigioValidationError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except DigioConfigurationError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        except DigioAPIError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_502_BAD_GATEWAY)

        email_sent = bool(getattr(row, "email_sent", False))
        email_error = (getattr(row, "email_error", "") or "").strip()
        message = "E-sign request sent"
        if not email_sent:
            message = (
                email_error
                or "E-sign was created, but the email could not be sent. Check SMTP settings."
            )
        return success_response(
            data=self._serialize(LeadEsignRequestSerializer, row).data,
            message=message,
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_any_permission("document.view", "document.download")
    @action(
        detail=True,
        methods=["get"],
        url_path=r"esign-requests/(?P<request_id>[^/.]+)/file",
    )
    def esign_request_file(self, request, pk=None, request_id=None):
        lead = self.get_object()
        row = LeadEsignRequest.objects.filter(lead=lead, pk=request_id).first()
        if row is None:
            return error_response(message="E-sign request not found", status_code=404)
        if row.status != EsignRequestStatus.SIGNED:
            return error_response(
                message="Signed document is not available yet.",
                status_code=404,
            )
        if not row.signed_file:
            from apps.integrations.digio.webhooks import refresh_esign_from_provider

            try:
                refresh_esign_from_provider(row)
                row.refresh_from_db()
            except Exception:
                logger.exception("Could not fetch signed e-sign PDF for request %s", row.pk)
        if not row.signed_file:
            return error_response(
                message="Signed document could not be retrieved from Digio. Try again shortly.",
                status_code=404,
            )
        filename = row.signed_file.name.rsplit("/", 1)[-1] or "Signed-Agreement.pdf"
        as_attachment = str(request.query_params.get("download") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        return FileResponse(
            row.signed_file.open("rb"),
            as_attachment=as_attachment,
            filename=filename,
            content_type="application/pdf",
        )

    @rbac_permission("lead.view")
    @action(detail=True, methods=["get", "post"], url_path="video-kyc-requests")
    def video_kyc_requests(self, request, pk=None):
        lead = self.get_object()

        if request.method == "GET":
            rows = LeadVideoKycRequest.objects.filter(lead=lead).select_related("requested_by")

            return success_response(
                data=self._serialize(LeadVideoKycRequestSerializer, rows, many=True).data
            )

        require_rbac(self, request, permission="lead.convert")

        email = request.data.get("recipient_email") or lead.customer.email

        try:
            row = create_lead_video_kyc_request(
                lead=lead,
                requested_by=request.user,
                recipient_email=email or "",
                verification_method=request.data.get("verification_method") or "mobile",
            )
        except DigioValidationError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        except DigioConfigurationError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        except DigioAPIError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_502_BAD_GATEWAY)

        return success_response(
            data=self._serialize(LeadVideoKycRequestSerializer, row).data,
            message="Video KYC request sent",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("lead.view")
    @action(
        detail=True,
        methods=["get"],
        url_path=r"video-kyc-requests/(?P<request_id>[^/.]+)",
    )
    def video_kyc_request_detail(self, request, pk=None, request_id=None):
        lead = self.get_object()

        row = (
            LeadVideoKycRequest.objects.filter(lead=lead, pk=request_id)
            .select_related("requested_by", "lead__customer")
            .first()
        )

        if row is None:
            return error_response(
                message="Video KYC request not found.", status_code=status.HTTP_404_NOT_FOUND
            )

        from apps.integrations.digio.webhooks import refresh_video_kyc_from_provider

        refresh_video_kyc_from_provider(row)
        row.refresh_from_db()

        return success_response(data=self._serialize(LeadVideoKycRequestDetailSerializer, row).data)

    @rbac_any_permission("lead.view", "loan.view", "collection.view", "disbursal.view")
    @action(detail=True, methods=["get"], url_path="employments")
    def employments(self, request, pk=None):
        lead = self.get_object()

        rows = CustomerEmployment.objects.filter(customer=lead.customer).order_by(
            "-is_current", "-created_at"
        )

        return success_response(
            data=self._serialize(LeadEmploymentSerializer, rows, many=True).data
        )

    @rbac_any_permission("lead.view", "loan.view", "collection.view", "disbursal.view")
    @action(detail=True, methods=["get"], url_path="status-histories")
    def status_histories(self, request, pk=None):
        if not user_has_permission(request.user, "workflow.view"):
            return error_response(
                message="You do not have permission to view status history.",
                status_code=403,
            )

        lead = self.get_object()

        LeadHistorySerializer = lead_status_history_serializer()

        ApplicationHistorySerializer = application_status_history_serializer()

        LoanHistorySerializer = loan_status_history_serializer()

        lead_rows = lead.status_history.select_related("changed_by").order_by("-changed_at")

        payload = {
            "lead": LeadHistorySerializer(lead_rows, many=True).data,
            "application": [],
            "loan": [],
        }

        application = (
            LoanApplication.objects.filter(lead=lead, is_deleted=False)
            .order_by("-created_at")
            .first()
        )

        if application is not None:
            app_rows = application.status_history.select_related("changed_by").order_by(
                "-changed_at"
            )

            payload["application"] = ApplicationHistorySerializer(app_rows, many=True).data

            loan = (
                Loan.objects.filter(application=application, is_deleted=False)
                .order_by("-created_at")
                .first()
            )

            if loan is not None:
                loan_rows = loan.status_history.select_related("changed_by").order_by("-changed_at")

                payload["loan"] = LoanHistorySerializer(loan_rows, many=True).data

        return success_response(data=payload)
