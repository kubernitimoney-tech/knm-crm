from django.contrib import admin

from apps.documents.models import Document, DocumentType, DocumentVersion


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_required")
    list_filter = ("is_required",)
    search_fields = ("name", "code")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("document_type", "title", "is_verified", "virus_scan_status", "created_at")
    list_filter = ("is_verified", "virus_scan_status", "document_type")


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ("document", "version_number", "file_name", "file_size", "uploaded_by")
