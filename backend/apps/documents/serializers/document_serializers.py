from rest_framework import serializers

from apps.documents.models import Document, DocumentType, DocumentVersion


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ["id", "code", "name", "is_required"]


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "version_number",
            "file",
            "file_name",
            "file_size",
            "mime_type",
            "created_at",
        ]


class DocumentSerializer(serializers.ModelSerializer):
    document_type_code = serializers.CharField(source="document_type.code", read_only=True)
    versions = DocumentVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "content_type",
            "object_id",
            "document_type",
            "document_type_code",
            "title",
            "is_verified",
            "virus_scan_status",
            "current_version",
            "versions",
            "created_at",
        ]
