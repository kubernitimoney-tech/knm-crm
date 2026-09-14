from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from apps.core.encryption import decrypt_for_display
from apps.core.validators.drf_fields import IndianMobileField
from apps.core.verification import (
    EntryVerificationStatus,
    apply_entry_verification_status,
    read_entry_verification_status,
)
from apps.customers.models import (
    AddressType,
    Customer,
    CustomerAddress,
    CustomerEmployment,
    CustomerReference,
)
from apps.customers.services.customer_service import CustomerService
from apps.documents.catalog import LEAD_DOCUMENT_TYPE_CODES
from apps.documents.models import Document
from apps.leads.models import (
    LeadEsignRequest,
    LeadVideoKycRequest,
    VideoKycRequestStatus,
)

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp"}
OTHERS_EXTRA_EXTENSIONS = {"zip"}
ZIP_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "multipart/x-zip",
}
DOCUMENT_TYPE_CODES = LEAD_DOCUMENT_TYPE_CODES


def _normalize_document_type_code(value: str) -> str:
    normalized = (value or "").strip().lower().replace(" ", "_")
    if normalized == "other":
        return "others"
    return normalized


def _file_extension(file_name: str) -> str:
    if "." not in file_name:
        return ""
    return file_name.rsplit(".", 1)[-1].lower()


def _is_zip_upload(file) -> bool:
    if _file_extension(file.name) == "zip":
        return True
    mime_type = (getattr(file, "content_type", "") or "").lower()
    return mime_type in ZIP_MIME_TYPES


def validate_lead_document_file(file, document_type: str) -> None:
    document_type = _normalize_document_type_code(document_type)
    allowed = set(ALLOWED_DOCUMENT_EXTENSIONS)
    if document_type == "others":
        allowed |= OTHERS_EXTRA_EXTENSIONS

    ext = _file_extension(file.name)
    if ext in allowed:
        return
    if document_type == "others" and _is_zip_upload(file):
        return

    if document_type == "others":
        raise serializers.ValidationError("For Others, only PDF, image, or ZIP files are allowed.")
    raise serializers.ValidationError(
        "Only PDF and image files are allowed for this document type."
    )


def _verification_status(obj) -> str:
    return read_entry_verification_status(obj)


def _format_address_line(address: CustomerAddress) -> str:
    parts = [address.line1.strip()]
    if address.line2.strip():
        parts.append(address.line2.strip())
    return ", ".join(parts)


from apps.leads.serializers.lead_serializers import LeadListSerializer  # noqa: E402


class LeadAddressSerializer(serializers.ModelSerializer):
    address_type_display = serializers.CharField(source="get_address_type_display", read_only=True)
    address = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "address_type",
            "address_type_display",
            "pincode",
            "state",
            "city",
            "address",
            "status",
            "created_at",
        ]
        read_only_fields = fields

    def get_address(self, obj):
        return _format_address_line(obj)

    def get_status(self, obj):
        return _verification_status(obj)


class LeadAddressWriteSerializer(serializers.Serializer):
    address_type = serializers.ChoiceField(choices=AddressType.choices, default=AddressType.OWN)
    pincode = serializers.CharField(max_length=10)
    state = serializers.CharField(max_length=100)
    city = serializers.CharField(max_length=100)
    address = serializers.CharField()
    status = serializers.ChoiceField(
        choices=EntryVerificationStatus.choices,
        required=False,
        default=EntryVerificationStatus.UNVERIFIED,
    )

    def create(self, validated_data):
        raise NotImplementedError("Use view create logic")

    def update(self, instance, validated_data):
        instance.address_type = validated_data.get("address_type", instance.address_type)
        instance.pincode = validated_data.get("pincode", instance.pincode)
        instance.state = validated_data.get("state", instance.state)
        instance.city = validated_data.get("city", instance.city)
        if "address" in validated_data:
            instance.line1 = validated_data["address"]
            instance.line2 = ""
        if "status" in validated_data:
            apply_entry_verification_status(instance, validated_data["status"])
        return instance


class LeadCompanySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="employer_name")
    company_address = serializers.CharField(source="designation")
    status = serializers.SerializerMethodField()

    class Meta:
        model = CustomerEmployment
        fields = [
            "id",
            "company_name",
            "company_address",
            "status",
            "created_at",
        ]
        read_only_fields = fields

    def get_status(self, obj):
        return _verification_status(obj)


class LeadCompanyWriteSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=255)
    company_address = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=EntryVerificationStatus.choices,
        required=False,
        default=EntryVerificationStatus.UNVERIFIED,
    )


class LeadReferenceSerializer(serializers.ModelSerializer):
    relation_display = serializers.CharField(source="get_relation_display", read_only=True)
    reference_name = serializers.CharField(source="name")
    reference_mobile = serializers.CharField(source="mobile_number")
    status = serializers.SerializerMethodField()

    class Meta:
        model = CustomerReference
        fields = [
            "id",
            "relation",
            "relation_display",
            "reference_name",
            "reference_mobile",
            "status",
            "created_at",
        ]
        read_only_fields = fields

    def get_status(self, obj):
        return _verification_status(obj)


class LeadReferenceWriteSerializer(serializers.Serializer):
    relation = serializers.ChoiceField(
        choices=CustomerReference._meta.get_field("relation").choices
    )
    reference_name = serializers.CharField(max_length=255)
    reference_mobile = IndianMobileField()
    status = serializers.ChoiceField(
        choices=EntryVerificationStatus.choices,
        required=False,
        default=EntryVerificationStatus.UNVERIFIED,
    )


class LeadDocumentSerializer(serializers.ModelSerializer):
    document_type = serializers.CharField(source="document_type.code", read_only=True)
    document_type_display = serializers.CharField(source="document_type.name", read_only=True)
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    password = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "document_type",
            "document_type_display",
            "file_name",
            "file_url",
            "password",
            "status",
            "created_at",
        ]
        read_only_fields = fields

    def _current_version(self, obj):
        if obj.current_version_id:
            return obj.current_version
        return obj.versions.order_by("-version_number").first()

    def get_file_name(self, obj):
        version = self._current_version(obj)
        return version.file_name if version else (obj.title or "")

    def get_file_url(self, obj):
        version = self._current_version(obj)
        if not version or not version.file:
            return None
        request = self.context.get("request")
        if request is None:
            return version.file.url
        return request.build_absolute_uri(version.file.url)

    def get_password(self, obj):
        return decrypt_for_display(obj.password)

    def get_status(self, obj):
        return _verification_status(obj)


class LeadDocumentWriteSerializer(serializers.Serializer):
    document_type = serializers.CharField()
    file = serializers.FileField()
    password = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=EntryVerificationStatus.choices,
        required=False,
        default=EntryVerificationStatus.UNVERIFIED,
    )

    def validate_document_type(self, value):
        normalized = _normalize_document_type_code(value)
        if normalized not in DOCUMENT_TYPE_CODES:
            raise serializers.ValidationError(f'"{value}" is not a valid document type.')
        return normalized

    def validate(self, attrs):
        validate_lead_document_file(attrs["file"], attrs["document_type"])
        return attrs


class LeadDocumentUpdateSerializer(serializers.Serializer):
    document_type = serializers.CharField(required=False)
    file = serializers.FileField(required=False)
    password = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=EntryVerificationStatus.choices, required=False)

    def validate_document_type(self, value):
        normalized = _normalize_document_type_code(value)
        if normalized not in DOCUMENT_TYPE_CODES:
            raise serializers.ValidationError(f'"{value}" is not a valid document type.')
        return normalized

    def validate(self, attrs):
        document = self.context.get("document")
        if (
            document
            and document.verification_status == EntryVerificationStatus.VERIFIED
            and attrs.get("status")
            in {EntryVerificationStatus.UNVERIFIED, EntryVerificationStatus.INCOMPLETE}
        ):
            raise serializers.ValidationError(
                {"status": "Verified documents cannot be marked unverified or incomplete."}
            )

        file = attrs.get("file")
        if file is None:
            return attrs

        document_type = attrs.get("document_type")
        if document_type is None:
            document = self.context.get("document")
            document_type = getattr(getattr(document, "document_type", None), "code", None)
        if document_type:
            validate_lead_document_file(file, document_type)
        return attrs


class LeadEsignRequestSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    documents = serializers.CharField(source="document_label", read_only=True)
    requested_on = serializers.DateTimeField(source="created_at", read_only=True)
    signed_on = serializers.SerializerMethodField()
    signed_file_url = serializers.SerializerMethodField()
    review_url = serializers.SerializerMethodField()

    class Meta:
        model = LeadEsignRequest
        fields = [
            "id",
            "status",
            "status_display",
            "requested_by_name",
            "documents",
            "requested_on",
            "signed_on",
            "signed_file_url",
            "sign_type",
            "request_url",
            "review_url",
            "provider_request_id",
        ]
        read_only_fields = fields

    def get_requested_by_name(self, obj):
        if not obj.requested_by:
            return "System"
        return obj.requested_by.get_full_name().strip() or obj.requested_by.email

    def get_signed_on(self, obj):
        return obj.signed_at.isoformat() if obj.signed_at else ""

    def get_signed_file_url(self, obj):
        if not obj.signed_file:
            return None
        request = self.context.get("request")
        if request is None:
            return obj.signed_file.url
        return request.build_absolute_uri(obj.signed_file.url)

    def get_review_url(self, obj):
        from apps.integrations.digio.gateway import customer_esign_review_url

        return customer_esign_review_url(obj.id)


class LeadVideoKycRequestSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    video = serializers.CharField(source="session_label", read_only=True)
    requested_on = serializers.DateTimeField(source="created_at", read_only=True)
    signed_on = serializers.SerializerMethodField()
    recording_file_url = serializers.SerializerMethodField()
    selfie_file_url = serializers.SerializerMethodField()
    email_sent = serializers.SerializerMethodField()

    class Meta:
        model = LeadVideoKycRequest
        fields = [
            "id",
            "status",
            "status_display",
            "requested_by_name",
            "video",
            "requested_on",
            "signed_on",
            "recording_file_url",
            "selfie_file_url",
            "email_sent",
            "request_url",
            "provider_request_id",
        ]
        read_only_fields = fields

    def get_requested_by_name(self, obj):
        if not obj.requested_by:
            return "System"
        return obj.requested_by.get_full_name().strip() or obj.requested_by.email

    def get_signed_on(self, obj):
        return obj.completed_at.isoformat() if obj.completed_at else ""

    def get_recording_file_url(self, obj):
        if not obj.recording_file:
            return None
        request = self.context.get("request")
        if request is None:
            return obj.recording_file.url
        return request.build_absolute_uri(obj.recording_file.url)

    def get_selfie_file_url(self, obj):
        if not obj.selfie_file:
            return None
        request = self.context.get("request")
        if request is None:
            return obj.selfie_file.url
        return request.build_absolute_uri(obj.selfie_file.url)

    def get_email_sent(self, obj):
        return bool((obj.session_details or {}).get("email_sent"))


def _customer_has_document(customer: Customer, document_code: str) -> bool:
    content_type = ContentType.objects.get_for_model(Customer)
    return Document.objects.filter(
        content_type=content_type,
        object_id=customer.pk,
        document_type__code=document_code,
    ).exists()


def _mask_identity(value: str, visible: int = 4) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return "—"
    if len(cleaned) <= visible:
        return cleaned
    return f"{'X' * (len(cleaned) - visible)}{cleaned[-visible:]}"


class LeadVideoKycRequestDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    approval_status = serializers.SerializerMethodField()
    ids_found = serializers.SerializerMethodField()
    date_time = serializers.SerializerMethodField()
    video_details = serializers.SerializerMethodField()
    aadhaar_details = serializers.SerializerMethodField()
    pan_details = serializers.SerializerMethodField()

    class Meta:
        model = LeadVideoKycRequest
        fields = [
            "id",
            "status",
            "customer_name",
            "customer_email",
            "approval_status",
            "ids_found",
            "date_time",
            "video_details",
            "aadhaar_details",
            "pan_details",
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        customer = obj.lead.customer
        name = f"{customer.first_name} {customer.last_name}".strip()
        return name or "—"

    def get_customer_email(self, obj):
        return obj.recipient_email or obj.lead.customer.email or "—"

    def get_approval_status(self, obj):
        if obj.status == VideoKycRequestStatus.COMPLETED:
            return "Approved"
        return "-----"

    def get_ids_found(self, obj):
        customer = obj.lead.customer
        session = obj.session_details or {}
        ids = session.get("ids_found") or {}
        return {
            "video": bool(ids.get("video", bool(obj.recording_file))),
            "selfie": bool(ids.get("selfie", bool(obj.selfie_file))),
            "aadhaar": bool(ids.get("aadhaar", _customer_has_document(customer, "aadhaar"))),
            "pan": bool(ids.get("pan", _customer_has_document(customer, "pan"))),
        }

    def get_date_time(self, obj):
        dt = obj.completed_at or obj.created_at
        return dt.isoformat() if dt else ""

    def get_video_details(self, obj):
        session = obj.session_details or {}
        geolocation = session.get("geolocation") or {}
        recording_url = None
        if obj.recording_file:
            request = self.context.get("request")
            if request is None:
                recording_url = obj.recording_file.url
            else:
                recording_url = request.build_absolute_uri(obj.recording_file.url)
        return {
            "geolocation": {
                "latitude": geolocation.get("latitude"),
                "longitude": geolocation.get("longitude"),
                "address": geolocation.get("address") or "—",
            },
            "recording_file_url": recording_url,
            "selfie_file_url": (
                request.build_absolute_uri(obj.selfie_file.url)
                if obj.selfie_file and request is not None
                else obj.selfie_file.url
                if obj.selfie_file
                else None
            ),
        }

    def _customer_address_line(self, customer: Customer) -> str:
        address = CustomerAddress.objects.filter(customer=customer).order_by("-created_at").first()
        if not address:
            return "—"
        parts = [
            address.line1,
            address.line2,
            address.city,
            address.state,
            address.pincode,
        ]
        return ", ".join(part for part in parts if part) or "—"

    def get_aadhaar_details(self, obj):
        session = obj.session_details or {}
        stored = session.get("aadhaar_details") or {}
        if stored:
            return stored
        customer = obj.lead.customer
        return {
            "name": self.get_customer_name(obj),
            "aadhaar_number": _mask_identity(CustomerService.get_primary_aadhaar(customer)),
            "date_of_birth": customer.dob.isoformat() if customer.dob else "—",
            "gender": customer.get_gender_display() if customer.gender else "—",
            "address": self._customer_address_line(customer),
        }

    def get_pan_details(self, obj):
        session = obj.session_details or {}
        stored = session.get("pan_details") or {}
        if stored:
            return stored
        customer = obj.lead.customer
        return {
            "name": self.get_customer_name(obj),
            "pan_number": _mask_identity(CustomerService.get_primary_pan(customer)),
            "date_of_birth": customer.dob.isoformat() if customer.dob else "—",
            "father_name": "—",
        }


class LeadEmploymentSerializer(serializers.ModelSerializer):
    employment_type_display = serializers.CharField(
        source="get_employment_type_display", read_only=True
    )

    class Meta:
        model = CustomerEmployment
        fields = [
            "id",
            "employer_name",
            "designation",
            "employment_type",
            "employment_type_display",
            "monthly_salary",
            "experience_months",
            "is_current",
            "created_at",
        ]
        read_only_fields = fields


class LeadWorkspaceSerializer(serializers.Serializer):
    def get_fields(self):
        from apps.customers.serializers.customer_serializers import CustomerSerializer

        return {
            "lead": LeadListSerializer(),
            "customer": CustomerSerializer(),
            "addresses": LeadAddressSerializer(many=True),
            "documents": LeadDocumentSerializer(many=True),
            "companies": LeadCompanySerializer(many=True),
            "references": LeadReferenceSerializer(many=True),
            "esign_requests": LeadEsignRequestSerializer(many=True),
            "video_kyc_requests": LeadVideoKycRequestSerializer(many=True),
            "employments": LeadEmploymentSerializer(many=True),
        }
