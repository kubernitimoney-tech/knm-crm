import logging

from django.conf import settings

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import customer_video_kyc_url, gateway_from_payload
from apps.leads.models import IntegrationProvider, LeadVideoKycRequest, VideoKycRequestStatus

logger = logging.getLogger(__name__)


def create_lead_video_kyc_request(
    *,
    lead,
    requested_by,
    recipient_email: str = "",
    verification_method: str = "mobile",
) -> LeadVideoKycRequest:
    customer = lead.customer
    verification_method = (verification_method or "mobile").strip().lower()
    if verification_method not in {"email", "mobile"}:
        raise DigioValidationError("Verification method must be email or mobile.")
    identifier = (
        recipient_email or customer.email
        if verification_method == "email"
        else customer.mobile_number
    )
    identifier = (identifier or "").strip()
    if not identifier:
        raise DigioValidationError(
            f"Customer {verification_method} is required to send the initial verification code."
        )

    template_name = (settings.DIGIO_KYC_TEMPLATE_NAME or "").strip()
    if not template_name:
        raise DigioConfigurationError(
            "Digio KYC template is not configured. Set DIGIO_KYC_TEMPLATE_NAME."
        )

    client = DigioClient.from_settings()
    payload = client.create_kyc_request(
        customer_identifier=identifier,
        customer_name=customer.full_name or identifier,
        template_name=template_name,
        reference_id=str(lead.id),
    )
    entity_id, access_token, request_url = gateway_from_payload(
        payload=payload if isinstance(payload, dict) else {},
        identifier=identifier,
        flow="ekyc",
    )
    if not entity_id:
        raise DigioAPIError("Digio did not return a KYC request id.")

    row = LeadVideoKycRequest.objects.create(
        lead=lead,
        requested_by=requested_by,
        session_label="Aadhaar + PAN + Selfie OCR",
        recipient_email=recipient_email or customer.email or "",
        status=VideoKycRequestStatus.SENT,
        provider=IntegrationProvider.DIGIO,
        provider_request_id=entity_id,
        request_url=request_url,
        access_token=access_token,
        session_details={
            "provider": IntegrationProvider.DIGIO.value,
            "request_id": entity_id,
            "workflow_name": template_name,
            "verification_method": verification_method,
            "customer_identifier": identifier,
        },
        created_by=requested_by,
        updated_by=requested_by,
    )
    if row.recipient_email:
        from apps.notifications.services.notification_service import NotificationService

        try:
            NotificationService.send_video_kyc_request_email(
                lead=lead,
                request_url=customer_video_kyc_url(row.id),
                recipient_email=row.recipient_email,
            )
        except Exception:
            logger.exception("Failed to email Video KYC link for lead %s", lead.lead_id)
            row.session_details["email_sent"] = False
        else:
            row.session_details["email_sent"] = True
        row.save(update_fields=["session_details", "updated_at"])
    return row
