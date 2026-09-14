from django.conf import settings
from django.db import models

from apps.core.models import AuditModel, TimeStampedModel, UUIDPrimaryKeyModel

from .lead import Lead

# class LeadDocumentType(models.TextChoices):
#     AADHAAR = "aadhaar", "Aadhaar Card"
#     PAN = "pan", "PAN Card"
#     CIBIL = "cibil_report", "Cibil Report"
#     BANK_STATEMENT = "bank_statement", "Bank Statement"
#     SELFIE = "photograph", "Selfie"
#     SALARY_SLIP = "salary_slip", "Salary Slip"
#     ID_CARD = "id_card", "ID Card"
#     CHEQUE = "cheque", "Cheque"
#     ELECTRICITY_BILL = "electricity_bill", "Electricity Bill"
#     MOBILE_BILL = "mobile_bill", "Mobile Bill"
#     OTHERS = "others", "Others"


# class LeadAddressType(models.TextChoices):
#     RESIDENTIAL = "residential", "Residential"
#     OFFICE = "office", "Office"
#     PERMANENT = "permanent", "Permanent"
#     CURRENT = "current", "Current"
#     CORRESPONDENCE = "correspondence", "Correspondence"


# class LeadReferenceRelation(models.TextChoices):
#     FATHER = "father", "Father"
#     MOTHER = "mother", "Mother"
#     BROTHER = "brother", "Brother"
#     SISTER = "sister", "Sister"
#     SPOUSE = "spouse", "Spouse"
#     FRIEND = "friend", "Friend"
#     COLLEAGUE = "colleague", "Colleague"
#     OTHER = "other", "Other"


class EsignRequestStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    SIGNED = "signed", "Signed"
    EXPIRED = "expired", "Expired"


class IntegrationProvider(models.TextChoices):
    DIGIO = "digio", "Digio"


class VideoKycRequestStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    COMPLETED = "completed", "Completed"
    EXPIRED = "expired", "Expired"


# class LeadDocument(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
#     lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="documents")
#     document_type = models.CharField(max_length=50, choices=LeadDocumentType.choices)
#     file = models.FileField(upload_to="lead_documents/%Y/%m/")
#     file_name = models.CharField(max_length=255)
#     file_size = models.PositiveBigIntegerField(default=0)
#     mime_type = models.CharField(max_length=100, blank=True)
#     password = models.CharField(max_length=255, blank=True)
#     status = models.CharField(
#         max_length=20,
#         choices=VerificationStatus.choices,
#         default=VerificationStatus.UNVERIFIED,
#     )

#     class Meta:
#         ordering = ["-created_at"]
#         indexes = [models.Index(fields=["lead", "document_type"])]


# class LeadAddress(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
#     lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="addresses")
#     address_type = models.CharField(max_length=30, choices=LeadAddressType.choices)
#     pincode = models.CharField(max_length=10)
#     state = models.CharField(max_length=100)
#     city = models.CharField(max_length=100)
#     address = models.TextField()
#     status = models.CharField(
#         max_length=20,
#         choices=VerificationStatus.choices,
#         default=VerificationStatus.UNVERIFIED,
#     )

#     class Meta:
#         ordering = ["-created_at"]


# class LeadCompanyDetail(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
#     lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="companies")
#     company_name = models.CharField(max_length=255)
#     company_address = models.TextField()
#     status = models.CharField(
#         max_length=20,
#         choices=VerificationStatus.choices,
#         default=VerificationStatus.UNVERIFIED,
#     )

#     class Meta:
#         ordering = ["-created_at"]


# class LeadReference(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
#     lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="references")
#     relation = models.CharField(max_length=30, choices=LeadReferenceRelation.choices)
#     reference_name = models.CharField(max_length=255)
#     reference_mobile = models.CharField(max_length=20)

#     class Meta:
#         ordering = ["-created_at"]


class LeadEsignRequest(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="esign_requests")
    status = models.CharField(
        max_length=20,
        choices=EsignRequestStatus.choices,
        default=EsignRequestStatus.SENT,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="esign_requests_sent",
    )
    document_label = models.CharField(max_length=255, default="Loan Agreement Pack")
    source_file = models.FileField(upload_to="lead_esign/source/%Y/%m/", blank=True)
    recipient_email = models.EmailField(blank=True)
    signed_file = models.FileField(upload_to="lead_esign/%Y/%m/", blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    sign_type = models.CharField(
        max_length=20,
        choices=[("aadhaar", "Aadhaar OTP"), ("electronic", "Email OTP")],
        default="electronic",
    )
    provider = models.CharField(
        max_length=20,
        choices=IntegrationProvider.choices,
        default=IntegrationProvider.DIGIO,
        db_index=True,
    )
    provider_request_id = models.CharField(max_length=64, blank=True, db_index=True)
    request_url = models.URLField(max_length=500, blank=True)
    access_token = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]


class LeadVideoKycRequest(UUIDPrimaryKeyModel, TimeStampedModel, AuditModel):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="video_kyc_requests")
    status = models.CharField(
        max_length=20,
        choices=VideoKycRequestStatus.choices,
        default=VideoKycRequestStatus.SENT,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="video_kyc_requests_sent",
    )
    session_label = models.CharField(max_length=255, default="Video KYC Session")
    recipient_email = models.EmailField(blank=True)
    recording_file = models.FileField(upload_to="lead_video_kyc/%Y/%m/", blank=True)
    selfie_file = models.FileField(upload_to="lead_video_kyc/selfie/%Y/%m/", blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    session_details = models.JSONField(default=dict, blank=True)
    provider = models.CharField(
        max_length=20,
        choices=IntegrationProvider.choices,
        default=IntegrationProvider.DIGIO,
        db_index=True,
    )
    provider_request_id = models.CharField(max_length=64, blank=True, db_index=True)
    request_url = models.URLField(max_length=500, blank=True)
    access_token = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
