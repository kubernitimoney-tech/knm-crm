import hashlib
import hmac
from decimal import Decimal
from unittest.mock import MagicMock, patch
from urllib.parse import quote

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.leads.models import (
    EsignRequestStatus,
    Lead,
    LeadEsignRequest,
    LeadSource,
    LeadVideoKycRequest,
    VideoKycRequestStatus,
)


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead() -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=f"LD-{customer.id.hex[:8].upper()}",
        customer=customer,
        source=source,
        required_amount=Decimal("25000"),
    )


def _hmac(body: bytes) -> str:
    return hmac.new(b"test-digio-webhook", body, hashlib.sha256).hexdigest()


@pytest.mark.django_db
class TestDigioEsignAndVideoKyc:
    def test_send_esign_persists_provider_id(self):
        admin = UserFactory(email="admin-digio-esign@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.return_value = {
            "id": "DID1234567890ABCD",
            "access_token": {"id": "tok-esign"},
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.esign.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.post(reverse("lead-esign-requests", kwargs={"pk": lead.id}), {})

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadEsignRequest.objects.get(lead=lead)
        assert row.provider_request_id == "DID1234567890ABCD"
        assert row.status == EsignRequestStatus.SENT
        assert response.data["data"]["request_url"] == row.request_url
        # Digio gateway segment order is requestId / identifier / tokenId.
        assert row.request_url.endswith(
            f"/#/gateway/login/DID1234567890ABCD/{quote(lead.customer.email, safe='')}/tok-esign"
        )

    def test_send_esign_fails_without_creating_row_when_digio_errors(self):
        from apps.integrations.digio.exceptions import DigioAPIError

        admin = UserFactory(email="admin-digio-esign-fail@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.side_effect = DigioAPIError("Digio sandbox rejected the PDF.")

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.esign.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.post(reverse("lead-esign-requests", kwargs={"pk": lead.id}), {})

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert LeadEsignRequest.objects.filter(lead=lead).count() == 0

    def test_send_video_kyc_persists_provider_id(self):
        admin = UserFactory(email="admin-digio-vkyc@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.create_kyc_request.return_value = {
            "id": "KID1234567890ABCD",
            "access_token": {"id": "tok-kyc"},
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.vkyc.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.post(reverse("lead-video-kyc-requests", kwargs={"pk": lead.id}), {})

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadVideoKycRequest.objects.get(lead=lead)
        assert row.provider_request_id == "KID1234567890ABCD"
        assert row.status == VideoKycRequestStatus.SENT

    def test_webhook_accepts_shared_token_in_url(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DID9876543210WXYZ",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"status": "completed"}
        mock_client.download_document.return_value = b"%PDF-1.4 signed"

        body = b'{"event":"doc.signed","id":"did9876543210wxyz"}'
        api = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = api.generic(
                "POST",
                f"{reverse('digio-webhook')}?token=test-digio-webhook",
                data=body,
                content_type="application/json",
            )

        assert response.status_code == status.HTTP_200_OK
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED

    def test_webhook_rejects_wrong_shared_token(self):
        api = APIClient()
        response = api.generic(
            "POST",
            f"{reverse('digio-webhook')}?token=not-the-secret",
            data=b'{"event":"doc.signed","id":"DID1234567890ABCD"}',
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_webhook_rejects_non_ascii_signature_without_crashing(self):
        api = APIClient()
        response = api.generic(
            "POST",
            reverse("digio-webhook"),
            data=b'{"event":"doc.signed","id":"DID1234567890ABCD"}',
            content_type="application/json",
            HTTP_X_DIGIO_SIGNATURE="sha256=café",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_webhook_rejects_bad_signature(self):
        client = APIClient()
        response = client.post(
            reverse("digio-webhook"),
            data={"event": "doc.signed", "id": "DID1234567890ABCD"},
            format="json",
            HTTP_X_DIGIO_SIGNATURE="deadbeef",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_webhook_marks_document_signed(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DID1234567890ABCD",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"status": "completed"}
        mock_client.download_document.return_value = b"%PDF-1.4 signed"

        body = b'{"event":"doc.signed","id":"DID1234567890ABCD"}'
        api = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = api.generic(
                "POST",
                reverse("digio-webhook"),
                data=body,
                content_type="application/json",
                HTTP_X_DIGIO_SIGNATURE=_hmac(body),
            )

        assert response.status_code == status.HTTP_200_OK
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED
        assert row.signed_file

    def test_webhook_marks_kyc_completed(self):
        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KID1234567890ABCD",
        )
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "id": "KID1234567890ABCD",
            "status": "approved",
            "actions": [{"type": "video_kyc", "details": {"geolocation": {"address": "Mumbai"}}}],
        }

        body = b'{"event":"kyc.approved","id":"KID1234567890ABCD"}'
        api = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = api.generic(
                "POST",
                reverse("digio-webhook"),
                data=body,
                content_type="application/json",
                HTTP_X_DIGIO_SIGNATURE=_hmac(body),
            )

        assert response.status_code == status.HTTP_200_OK
        row.refresh_from_db()
        assert row.status == VideoKycRequestStatus.COMPLETED
        assert row.session_details.get("ids_found", {}).get("video") is True


class TestDigioClientResponseHandling:
    def test_html_body_explains_wrong_host_or_credentials(self):
        from apps.integrations.digio.client import DigioClient
        from apps.integrations.digio.exceptions import DigioAPIError

        html = b"<!DOCTYPE html><html><head></head><body>Login</body></html>"
        client = DigioClient(
            base_url="https://ext-api.digio.in",
            client_id="id",
            client_secret="secret",
        )
        response = MagicMock()
        response.read.return_value = html
        response.status = 200
        response.headers = {"Content-Type": "text/html"}
        response.__enter__.return_value = response
        response.__exit__.return_value = False

        with patch.object(client, "_open", return_value=response):
            with pytest.raises(DigioAPIError, match="web page instead of JSON"):
                client.upload_pdf(
                    file_name="a.pdf",
                    file_bytes=b"%PDF-1.4",
                    signer_name="Test",
                    identifier="test@example.com",
                    sign_type="aadhaar",
                )

    def test_http_redirect_explains_sandbox_setup(self):
        import urllib.error
        from io import BytesIO

        from apps.integrations.digio.client import DigioClient
        from apps.integrations.digio.exceptions import DigioAPIError

        client = DigioClient(
            base_url="https://ext-api.digio.in",
            client_id="id",
            client_secret="secret",
        )
        error = urllib.error.HTTPError(
            "https://ext.digio.in/login",
            302,
            "Found",
            hdrs=None,
            fp=BytesIO(b""),
        )
        with patch.object(client, "_open", side_effect=error):
            with pytest.raises(DigioAPIError, match="redirected"):
                client.get_document("DID123")
