from django.conf import settings

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import customer_identifier, gateway_from_payload
from apps.leads.models import IntegrationProvider, LeadVideoKycRequest, VideoKycRequestStatus


def create_lead_video_kyc_request(
    *, lead, requested_by, recipient_email: str = ""
) -> LeadVideoKycRequest:
    customer = lead.customer
    identifier = customer_identifier(customer=customer, recipient_email=recipient_email)
    if not identifier:
        raise DigioValidationError("Customer email or mobile number is required to send video KYC.")

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
    )
    if not entity_id:
        raise DigioAPIError("Digio did not return a KYC request id.")

    return LeadVideoKycRequest.objects.create(
        lead=lead,
        requested_by=requested_by,
        recipient_email=recipient_email or customer.email or "",
        status=VideoKycRequestStatus.SENT,
        provider=IntegrationProvider.DIGIO,
        provider_request_id=entity_id,
        request_url=request_url,
        access_token=access_token,
        session_details={"provider": IntegrationProvider.DIGIO.value, "request_id": entity_id},
        created_by=requested_by,
        updated_by=requested_by,
    )
