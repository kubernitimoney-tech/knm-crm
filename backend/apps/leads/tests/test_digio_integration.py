import hashlib
import hmac
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
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
            "url": "https://drive.digio.in/#/authenticate",
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.esign.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.post(
                reverse("lead-esign-requests", kwargs={"pk": lead.id}),
                {"sign_type": "aadhaar"},
            )

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadEsignRequest.objects.get(lead=lead)
        assert row.provider_request_id == "DID1234567890ABCD"
        assert row.status == EsignRequestStatus.SENT
        assert row.sign_type == "aadhaar"
        assert row.source_file
        assert response.data["data"]["request_url"] == row.request_url
        assert response.data["data"]["sign_type"] == "aadhaar"
        assert mock_client.upload_pdf.call_args.kwargs["sign_type"] == "aadhaar"
        # Digio gateway segment order is requestId / identifier / tokenId.
        assert row.request_url.endswith(
            f"/#/gateway/login/DID1234567890ABCD/{lead.customer.email}/tok-esign"
        )
        assert "@" in row.request_url
        assert "drive.digio.in" not in row.request_url
        from django.core import mail

        assert len(mail.outbox) == 1
        assert f"/sign/{row.id}" in mail.outbox[0].body
        assert "Aadhaar" in mail.outbox[0].body
        from io import BytesIO

        from pypdf import PdfReader

        from apps.integrations.digio.pdf import build_agreement_pdf

        pdf = build_agreement_pdf(lead=lead)
        reader = PdfReader(BytesIO(pdf))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        assert len(reader.pages) == 28
        assert "LAXMI" in text
        assert lead.customer.full_name in text
        assert "Naman Commodities" not in text
        assert "NCPL" not in text
        assert "MENIKA KUMARI" not in text
        assert "pankajanand702@gmail.com" not in text
        assert "/AcroForm" not in reader.trailer["/Root"]

    def test_send_esign_uses_configured_sign_type(self):
        admin = UserFactory(email="admin-digio-email-otp@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.return_value = {
            "id": "DIDEMAILOTP123456",
            "access_token": {"id": "tok-email"},
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with override_settings(DIGIO_ESIGN_SIGN_TYPE="electronic"):
            with patch(
                "apps.integrations.digio.esign.DigioClient.from_settings",
                return_value=mock_client,
            ):
                response = client.post(
                    reverse("lead-esign-requests", kwargs={"pk": lead.id}),
                    {"sign_type": "aadhaar"},
                )

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadEsignRequest.objects.get(lead=lead)
        assert row.sign_type == "electronic"
        assert mock_client.upload_pdf.call_args.kwargs["sign_type"] == "electronic"

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
        assert "/#/gateway/ekyc/" in row.request_url
        assert row.session_details["email_sent"] is True
        assert response.data["data"]["email_sent"] is True
        assert row.session_details["sms_sent"] is True
        assert response.data["data"]["sms_sent"] is True
        assert mock_client.create_kyc_request.call_args.kwargs["customer_identifier"] == (
            lead.customer.mobile_number
        )
        from django.core import mail

        assert len(mail.outbox) == 1
        assert f"/verify-kyc/{row.id}" in mail.outbox[0].body
        assert mail.outbox[0].to == [lead.customer.email]
        from apps.notifications.services.sms_service import SmsService

        assert SmsService.outbox
        assert SmsService.outbox[-1]["mobile"] == lead.customer.mobile_number
        assert f"/verify-kyc/{row.id}" in SmsService.outbox[-1]["message"]
        public = client.get(reverse("public-video-kyc", kwargs={"pk": row.id}))
        assert public.status_code == status.HTTP_200_OK
        assert public.data["data"]["document_id"] == row.provider_request_id
        assert public.data["data"]["identifier"] == lead.customer.mobile_number
        assert "access_token" not in public.data["data"]
        assert "gateway_url" not in public.data["data"]

    def test_send_video_kyc_can_use_email_for_initial_code(self):
        admin = UserFactory(email="admin-digio-vkyc-email@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.create_kyc_request.return_value = {"id": "KIDEMAILCODE12345"}

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.vkyc.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.post(
                reverse("lead-video-kyc-requests", kwargs={"pk": lead.id}),
                {"verification_method": "email"},
            )

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadVideoKycRequest.objects.get(lead=lead)
        assert row.session_details["verification_method"] == "email"
        assert row.session_details["customer_identifier"] == lead.customer.email
        assert mock_client.create_kyc_request.call_args.kwargs["customer_identifier"] == (
            lead.customer.email
        )

    def test_public_esign_review_endpoint(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            request_url="https://app.digio.in/#/gateway/login/DID/x@y.com/GWT",
            provider_request_id="DIDPUBLIC123456789",
            access_token="tok-public",
        )
        client = APIClient()
        response = client.get(reverse("public-esign", kwargs={"pk": row.id}))
        assert response.status_code == status.HTTP_200_OK
        payload = response.data["data"]
        assert payload["id"] == str(row.id)
        assert payload["sign_type"] == row.sign_type
        assert payload["signing_url"] == row.request_url
        assert payload["document_id"] == "DIDPUBLIC123456789"
        assert payload["identifier"] == lead.customer.email
        assert payload["access_token"] == "tok-public"
        assert payload["sdk_url"].endswith("/sdk/v11/digio.js")
        assert f"/sign/{row.id}" in payload["review_url"]
        assert payload["document_url"].endswith(f"/api/v1/leads/esign/{row.id}/document/")
        document = client.get(reverse("public-esign-document", kwargs={"pk": row.id}))
        assert document.status_code == status.HTTP_200_OK
        assert document["Content-Type"].startswith("application/pdf")

    def test_gateway_ignores_digio_drive_login_url(self):
        from apps.integrations.digio.gateway import gateway_from_payload

        entity_id, token, url = gateway_from_payload(
            payload={
                "id": "DIDDRIVE123456789",
                "access_token": {"id": "tok-guest"},
                "url": "https://drive.digio.in/#/authenticate",
            },
            identifier="customer@example.com",
        )
        assert entity_id == "DIDDRIVE123456789"
        assert token == "tok-guest"
        assert "drive.digio.in" not in url
        assert url.endswith("/#/gateway/login/DIDDRIVE123456789/customer@example.com/tok-guest")
        assert "%40" not in url

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

    def test_webhook_maps_digistudio_aadhaar_pan_and_selfie(self):
        import base64

        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KIDSELFIEOCR12345",
        )
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "request_details": {
                "id": "KIDSELFIEOCR12345",
                "status": "approved",
                "workflow_name": "AadharPAN with selfie and OCR",
                "actions": [
                    {
                        "type": "digilocker",
                        "action_ref": "AADHAAR",
                        "action_data": {"aadhaar_number": "XXXX1234", "name": "Test User"},
                    },
                    {
                        "type": "generic_document_ocr",
                        "action_ref": "PAN OCR",
                        "ocr_result": {"pan": "ABCDE1234F", "full_name": "Test User"},
                    },
                    {
                        "type": "selfie",
                        "status": "approved",
                        "file_base64": base64.b64encode(b"jpeg-selfie").decode(),
                    },
                ],
            }
        }

        body = b'{"event":"kyc.approved","id":"KIDSELFIEOCR12345"}'
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
        assert row.selfie_file
        assert row.session_details["ids_found"] == {
            "video": False,
            "selfie": True,
            "aadhaar": True,
            "pan": True,
        }
        assert row.session_details["aadhaar_details"]["action_data_aadhaar_number"] == "XXXX1234"
        assert row.session_details["pan_details"]["ocr_result_pan"] == "ABCDE1234F"

    def test_webhook_saves_video_recording_and_lat_lng_aliases(self):
        import base64

        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KIDVIDEOGEO123456",
        )
        video = b"\x00\x00\x00\x18ftypmp42" + b"0" * 80
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "id": "KIDVIDEOGEO123456",
            "status": "approved",
            "actions": [
                {
                    "type": "video_kyc",
                    "file_base64": base64.b64encode(video).decode(),
                    "details": {"lat": "19.076", "lng": "72.877", "address": "Mumbai"},
                }
            ],
        }
        mock_client.download_kyc_media.return_value = b""

        body = b'{"event":"kyc.approved","id":"KIDVIDEOGEO123456"}'
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
        assert row.recording_file
        assert row.session_details["geolocation"]["latitude"] == 19.076
        assert row.session_details["geolocation"]["longitude"] == 72.877
        assert row.session_details["geolocation"]["address"] == "Mumbai"

    def test_webhook_downloads_kyc_media_by_file_id(self):
        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KIDFILEIDVIDEO123",
        )
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "id": "KIDFILEIDVIDEO123",
            "status": "approved",
            "actions": [{"type": "video", "file_id": "FIDVIDEO123", "details": {}}],
        }
        mock_client.download_kyc_media.return_value = b"\x00\x00\x00\x18ftypmp42" + b"1" * 40

        body = b'{"event":"kyc.approved","id":"KIDFILEIDVIDEO123"}'
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
        assert row.recording_file
        mock_client.download_kyc_media.assert_called()

    def test_public_esign_aadhaar_otp_signs_document(self):
        import base64

        admin = UserFactory(email="admin-digio-aadhaar-otp@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.return_value = {"id": "DIDAADHAAROTP1234"}
        mock_client.generate_aadhaar_esign_otp.return_value = {"status": "success"}
        mock_client.complete_aadhaar_esign.return_value = {
            "id": "DIDAADHAAROTP1234",
            "file_data": base64.b64encode(b"%PDF-signed").decode(),
        }

        api = APIClient()
        api.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.esign.DigioClient.from_settings",
            return_value=mock_client,
        ):
            created = api.post(
                reverse("lead-esign-requests", kwargs={"pk": lead.id}),
                {"sign_type": "aadhaar"},
            )
            assert created.status_code == status.HTTP_201_CREATED
            row = LeadEsignRequest.objects.get(lead=lead)
            email_otp = api.post(reverse("public-esign-email-otp", kwargs={"pk": row.id}), {})
            assert email_otp.status_code == status.HTTP_200_OK
            from django.core.cache import cache

            from apps.integrations.digio.esign import AADHAAR_OTP_KEY, EMAIL_OTP_KEY

            email_code = cache.get(EMAIL_OTP_KEY.format(row.id))
            assert email_code
            verify_email = api.post(
                reverse("public-esign-verify-email-otp", kwargs={"pk": row.id}),
                {"otp": email_code},
                format="json",
            )
            assert verify_email.status_code == status.HTTP_200_OK
            otp_response = api.post(
                reverse("public-esign-otp", kwargs={"pk": row.id}),
                {"aadhaar_number": "234123412341"},
                format="json",
            )
            assert otp_response.status_code == status.HTTP_200_OK
            vid_response = api.post(
                reverse("public-esign-otp", kwargs={"pk": row.id}),
                {"aadhaar_number": "1234123412341234"},
                format="json",
            )
            assert vid_response.status_code == status.HTTP_200_OK
            aadhaar_cached = cache.get(AADHAAR_OTP_KEY.format(row.id)) or {}
            aadhaar_code = aadhaar_cached.get("otp")
            assert aadhaar_code
            verify_response = api.post(
                reverse("public-esign-verify-otp", kwargs={"pk": row.id}),
                {"otp": aadhaar_code},
                format="json",
            )

        assert verify_response.status_code == status.HTTP_200_OK
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED
        assert row.signed_file
        assert verify_response.data["data"]["signed"] is True


class TestDigioClientResponseHandling:
    def test_digistudio_request_includes_tracking_fields(self):
        from apps.integrations.digio.client import DigioClient

        client = DigioClient(
            base_url="https://api.digio.in", client_id="id", client_secret="secret"
        )
        with patch.object(client, "request", return_value={}) as request:
            client.create_kyc_request(
                customer_identifier="test@example.com",
                customer_name="Test User",
                template_name="AadharPAN with selfie and OCR",
                reference_id="01234567-89ab-cdef-0123-456789abcdef",
            )

        method, path, payload = request.call_args.args
        assert method == "POST"
        assert path == "/client/kyc/v2/request/with_template"
        assert payload["notify_customer"] is True
        assert payload["generate_access_token"] is False
        assert payload["transaction_id"] == "0123456789abcdef0123456789abcdef"

    def test_digistudio_details_uses_post_with_detailed_response(self):
        from apps.integrations.digio.client import DigioClient

        client = DigioClient(
            base_url="https://api.digio.in", client_id="id", client_secret="secret"
        )
        with patch.object(client, "request", return_value={}) as request:
            client.get_kyc_response("KID123")

        request.assert_called_once_with(
            "POST",
            "/client/kyc/v2/KID123/response?detail_response=true&file_data=true",
        )

    def test_generic_digio_error_never_returns_none(self):
        from apps.integrations.digio.client import _friendly_error

        message = _friendly_error(
            '{"details":"EX123","code":"REQUEST_VALIDATION_FAILED","message":"may not be empty. "}',
            fallback="Digio request failed (400).",
        )

        assert message.startswith("may not be empty.")
        assert "REQUEST_VALIDATION_FAILED" in message
        assert "EX123" in message

    @override_settings(DIGIO_BASE_URL="https://enterprise.digio.in")
    def test_dashboard_host_is_rejected_as_api_base_url(self):
        from apps.integrations.digio.client import DigioClient
        from apps.integrations.digio.exceptions import DigioConfigurationError

        with pytest.raises(DigioConfigurationError, match="not its REST API"):
            DigioClient.from_settings()

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
