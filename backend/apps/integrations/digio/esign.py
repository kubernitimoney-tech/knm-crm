import logging
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import (
    DigioAPIError,
    DigioConfigurationError,
    DigioValidationError,
)
from apps.integrations.digio.gateway import (
    customer_esign_review_url,
    customer_identifier,
    gateway_from_payload,
)
from apps.integrations.digio.pdf import build_agreement_pdf
from apps.leads.models import EsignRequestStatus, IntegrationProvider, LeadEsignRequest

logger = logging.getLogger(__name__)

SIGN_TYPES = frozenset({"aadhaar", "electronic"})


def create_lead_esign_request(
    *,
    lead,
    requested_by,
    recipient_email: str = "",
    sign_type: str = "",
) -> LeadEsignRequest:
    customer = lead.customer
    identifier = customer_identifier(customer=customer, recipient_email=recipient_email)
    if not identifier:
        raise DigioValidationError("Customer email or mobile number is required to send e-sign.")

    sign_type = (sign_type or settings.DIGIO_ESIGN_SIGN_TYPE or "electronic").strip().lower()
    if sign_type not in SIGN_TYPES:
        raise DigioConfigurationError(
            f"DIGIO_ESIGN_SIGN_TYPE must be one of {sorted(SIGN_TYPES)}, got '{sign_type}'."
        )

    esign_id = uuid4()
    review_url = customer_esign_review_url(esign_id)
    client = DigioClient.from_settings()
    pdf_bytes = build_agreement_pdf(lead=lead)
    payload = client.upload_pdf(
        file_name=f"{lead.lead_id}-loan-agreement.pdf",
        file_bytes=pdf_bytes,
        signer_name=customer.full_name or identifier,
        identifier=identifier,
        sign_type=sign_type,
        redirect_url=f"{review_url}?done=1",
    )
    entity_id, access_token, request_url = gateway_from_payload(
        payload=payload if isinstance(payload, dict) else {},
        identifier=identifier,
    )
    if not entity_id:
        raise DigioAPIError("Digio did not return a document id for the e-sign request.")

    row = LeadEsignRequest.objects.create(
        id=esign_id,
        lead=lead,
        requested_by=requested_by,
        document_label="Agreement.pdf",
        source_file=ContentFile(pdf_bytes, name=f"{lead.lead_id}-loan-agreement.pdf"),
        recipient_email=recipient_email or customer.email or "",
        status=EsignRequestStatus.SENT,
        sign_type=sign_type,
        provider=IntegrationProvider.DIGIO,
        provider_request_id=entity_id,
        request_url=request_url,
        access_token=access_token,
        created_by=requested_by,
        updated_by=requested_by,
    )
    if (row.recipient_email or "").strip():
        from apps.notifications.services.notification_service import NotificationService

        try:
            NotificationService.send_esign_request_email(
                lead=lead,
                request_url=review_url,
                recipient_email=row.recipient_email,
                sign_type=sign_type,
            )
        except Exception:
            logger.exception("Failed to email e-sign guest link for lead %s", lead.lead_id)
    return row
