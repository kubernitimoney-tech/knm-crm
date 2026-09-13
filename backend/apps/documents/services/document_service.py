from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from apps.activities.services.activity_service import ActivityService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.documents.catalog import LEAD_DOCUMENT_TYPE_CATALOG
from apps.documents.models import Document, DocumentType, DocumentVersion
from apps.documents.services.scan import scan_file_for_virus
from apps.documents.storage.backends import get_storage_backend


class DocumentTypeNotFoundError(Exception):
    pass


class DocumentService:
    @classmethod
    def resolve_document_type(cls, code: str) -> DocumentType:
        normalized = (code or "").strip().lower()
        entry = LEAD_DOCUMENT_TYPE_CATALOG.get(normalized)
        if entry is None:
            raise DocumentTypeNotFoundError(normalized or code)
        name, is_required = entry
        document_type, _ = DocumentType.objects.get_or_create(
            code=normalized,
            defaults={"name": name, "is_required": is_required},
        )
        return document_type

    @classmethod
    @transaction.atomic
    def upload_document(
        cls,
        *,
        user,
        content_object,
        document_type,
        uploaded_file,
        title: str = "",
    ) -> DocumentVersion:
        content_type = ContentType.objects.get_for_model(content_object)
        document, _ = Document.objects.get_or_create(
            content_type=content_type,
            object_id=content_object.pk,
            document_type=document_type,
            defaults={"title": title, "created_by": user, "updated_by": user},
        )
        scan_status = scan_file_for_virus(uploaded_file)
        document.virus_scan_status = scan_status
        document.updated_by = user
        document.save()

        last_version = document.versions.order_by("-version_number").first()
        version_number = (last_version.version_number + 1) if last_version else 1

        storage = get_storage_backend()
        path = (
            f"documents/{content_type.model}/{content_object.pk}/"
            f"{document_type.code}/v{version_number}_{uploaded_file.name}"
        )
        saved_path = storage.save(path, uploaded_file)

        version = DocumentVersion.objects.create(
            document=document,
            version_number=version_number,
            file=saved_path,
            file_name=uploaded_file.name[:255],
            file_size=uploaded_file.size,
            mime_type=(getattr(uploaded_file, "content_type", "") or "")[:255],
            uploaded_by=user,
        )
        document.current_version = version
        document.save(update_fields=["current_version", "updated_at"])

        ActivityService.log(
            actor=user,
            verb="uploaded",
            description="Document Uploaded",
            target=document,
            metadata={"document_type": document_type.code, "version": version_number},
        )
        UserActivityService.log(
            user=user,
            action=UserActivityAction.UPLOAD,
            description=(
                f"Uploaded {document_type.code} document "
                f"(v{version_number}) for {content_type.model} {content_object.pk}"
            ),
            metadata={
                "document_id": str(document.pk),
                "document_type": document_type.code,
                "version": version_number,
                "content_type": content_type.model,
                "object_id": str(content_object.pk),
            },
        )
        return version
