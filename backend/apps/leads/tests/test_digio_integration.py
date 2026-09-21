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
        assert mail.outbox[0].subject == (
            "Please complete KYC process of Kuberniti Money with Har Shreejee Finance "
            "& Leasing Company Limited."
        )
        assert "Start KYC Process" in mail.outbox[0].body
        assert "Know Your Customer (KYC)" in mail.outbox[0].body
        assert "Compliance Team" in mail.outbox[0].body
        from io import BytesIO

        from pypdf import PdfReader

        from apps.integrations.digio.pdf import build_agreement_pdf

        pdf = build_agreement_pdf(lead=lead)
        reader = PdfReader(BytesIO(pdf))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        assert len(reader.pages) == 10
        assert lead.customer.full_name in text
        assert "Har Shreejee" in text
        assert "BORROWER'S LOAN AGREEMENT" in text or "BORROWER’S LOAN AGREEMENT" in text
        assert "Naman Commodities" not in text
        assert "LAXMI" not in text
        assert "MENIKA KUMARI" not in text
        assert "pankajanand702@gmail.com" not in text
        assert "/AcroForm" not in reader.trailer["/Root"]
        assert mock_client.upload_pdf.call_args.kwargs["display_on_page"] == "custom"
        assert "8" in mock_client.upload_pdf.call_args.kwargs["sign_coordinates"]
        assert "10" in mock_client.upload_pdf.call_args.kwargs["sign_coordinates"]
        assert response.data["data"]["email_sent"] is True

    def test_send_esign_reports_email_failure(self):
        admin = UserFactory(email="admin-digio-esign-mailfail@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.return_value = {
            "id": "DIDMAILFAIL123456",
            "access_token": {"id": "tok-mailfail"},
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with (
            patch(
                "apps.integrations.digio.esign.DigioClient.from_settings",
                return_value=mock_client,
            ),
            patch(
                "apps.notifications.services.email_service.EmailService.send_html",
                side_effect=RuntimeError("SMTP authentication failed"),
            ),
        ):
            response = client.post(
                reverse("lead-esign-requests", kwargs={"pk": lead.id}),
                {"sign_type": "aadhaar"},
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert LeadEsignRequest.objects.filter(lead=lead).count() == 1
        assert response.data["data"]["email_sent"] is False
        assert "SMTP authentication failed" in response.data["data"]["email_error"]
        assert "SMTP authentication failed" in response.data["message"]

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
                    {},
                )

        assert response.status_code == status.HTTP_201_CREATED
        row = LeadEsignRequest.objects.get(lead=lead)
        assert row.sign_type == "electronic"
        assert mock_client.upload_pdf.call_args.kwargs["sign_type"] == "electronic"

    def test_send_esign_request_sign_type_overrides_settings(self):
        admin = UserFactory(email="admin-digio-aadhaar-override@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        mock_client = MagicMock()
        mock_client.upload_pdf.return_value = {
            "id": "DIDAADHAAROVERRIDE1",
            "access_token": {"id": "tok-aadhaar"},
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
        assert row.sign_type == "aadhaar"
        assert mock_client.upload_pdf.call_args.kwargs["sign_type"] == "aadhaar"

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
        assert mail.outbox[0].subject == (
            "Please complete KYC process of Kuberniti Money with Har Shreejee Finance "
            "& Leasing Company Limited."
        )
        assert "Start KYC Process" in mail.outbox[0].body
        assert "Know Your Customer (KYC)" in mail.outbox[0].body
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

    def test_public_video_kyc_sync_marks_completed_from_digio(self):
        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KIDSYNC1234567890AB",
            session_details={"customer_identifier": lead.customer.mobile_number},
        )
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "id": "KIDSYNC1234567890AB",
            "status": "approved",
        }

        client = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(
                reverse("public-video-kyc", kwargs={"pk": row.id}),
                {"sync": "1", "force": "1"},
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["completed"] is True
        assert response.data["data"]["status"] == VideoKycRequestStatus.COMPLETED
        row.refresh_from_db()
        assert row.status == VideoKycRequestStatus.COMPLETED
        from django.core import mail

        assert any(item.subject == "Video KYC Successfully Completed" for item in mail.outbox)

    def test_video_kyc_list_refreshes_sent_rows_from_digio(self):
        admin = UserFactory(email="admin-digio-vkyc-list@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        row = LeadVideoKycRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=VideoKycRequestStatus.SENT,
            provider_request_id="KIDLISTREFRESH1234",
            session_details={"email_sent": True},
        )
        mock_client = MagicMock()
        mock_client.get_kyc_response.return_value = {
            "id": "KIDLISTREFRESH1234",
            "status": "approval_pending",
        }

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(reverse("lead-video-kyc-requests", kwargs={"pk": lead.id}))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"][0]["status"] == VideoKycRequestStatus.COMPLETED
        row.refresh_from_db()
        assert row.status == VideoKycRequestStatus.COMPLETED

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
        assert payload["document_id"] in payload["signing_url"]
        assert payload["identifier"] in payload["signing_url"]
        assert payload["access_token"] in payload["signing_url"]
        assert payload["document_id"] == "DIDPUBLIC123456789"
        assert payload["identifier"] == lead.customer.email
        assert payload["access_token"] == "tok-public"
        assert payload["sdk_url"].endswith("/sdk/v11/digio.js")
        assert f"/sign/{row.id}" in payload["review_url"]
        assert payload["company_url"]
        assert payload["document_url"].endswith(f"/api/v1/leads/esign/{row.id}/document/")
        document = client.get(reverse("public-esign-document", kwargs={"pk": row.id}))
        assert document.status_code == status.HTTP_200_OK
        assert document["Content-Type"].startswith("application/pdf")

    def test_public_esign_sync_marks_signed_from_digio(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DIDSYNC1234567890AB",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"status": "completed"}
        mock_client.download_document.return_value = b"%PDF-signed"

        client = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(reverse("public-esign", kwargs={"pk": row.id}), {"sync": "1"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["signed"] is True
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED
        assert row.signed_file

    def test_public_esign_sync_marks_signed_from_signing_party(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DIDPARTYSIGNED12345",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {
            "agreement_status": "requested",
            "signing_parties": [{"status": "signed"}],
        }
        mock_client.download_document.return_value = b"%PDF-signed-party"

        client = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(reverse("public-esign", kwargs={"pk": row.id}), {"sync": "1"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["signed"] is True
        assert response.data["data"]["signed_file_url"].endswith(
            f"/api/v1/leads/esign/{row.id}/document/"
        )
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED

    def test_public_esign_force_sync_downloads_after_sdk_success(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DIDFORCESYNC1234567",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"agreement_status": "requested"}
        mock_client.download_document.return_value = b"%PDF-forced"

        client = APIClient()
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(
                reverse("public-esign", kwargs={"pk": row.id}),
                {"sync": "1", "force": "1"},
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["signed"] is True
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED
        assert row.signed_file

    def test_agreement_pdf_swaps_footer_logo_and_ticks_only_after_sign(self):
        from io import BytesIO

        from pypdf import PdfReader

        from apps.integrations.digio.pdf import (
            _SIGNATURE_CARDS,
            LAST_THREE_SIGN_COORDINATES,
            PAGE_HEIGHT,
            apply_completed_signature_marks,
            build_agreement_pdf,
        )

        lead = _create_lead()
        unsigned = build_agreement_pdf(lead=lead)
        unsigned_size = len(unsigned)
        signed = apply_completed_signature_marks(
            unsigned,
            signer_name=lead.customer.full_name,
            signer_location="New Delhi",
        )
        assert len(PdfReader(BytesIO(unsigned)).pages) == 10
        assert len(PdfReader(BytesIO(signed)).pages) == 10
        assert len(signed) != unsigned_size
        unsigned_text = "\n".join(
            page.extract_text() or "" for page in PdfReader(BytesIO(unsigned)).pages
        )
        signed_text = "\n".join(
            page.extract_text() or "" for page in PdfReader(BytesIO(signed)).pages
        )
        assert "Kuberniti Money" in unsigned_text
        assert "Digitally Signed by:" in signed_text
        assert "Name:" in signed_text
        assert "Location:" in signed_text
        assert "Reason: Loan Agreement" in signed_text
        assert "eSigned using Aadhaar" not in signed_text
        assert "Signed by: Nishant" not in signed_text

        for page, index in (("8", 7), ("9", 8), ("10", 9)):
            box = LAST_THREE_SIGN_COORDINATES[page][0]
            card_x, card_top, card_width, card_height = _SIGNATURE_CARDS[index]
            # Digio's longest line, "eSigned using Aadhaar (digio.in)", needs ~125pt.
            assert box["urx"] - box["llx"] >= 140
            assert box["ury"] - box["lly"] >= 55
            # Stamp sits in the reserved block and stays above the footer band.
            assert box["llx"] >= card_x
            assert box["urx"] <= card_x + card_width
            assert box["lly"] >= PAGE_HEIGHT - card_top - card_height
            assert box["ury"] <= PAGE_HEIGHT - card_top
            assert box["lly"] >= 45

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

    def test_gateway_rebuilds_incomplete_guest_url_with_identifier(self):
        from apps.integrations.digio.gateway import gateway_from_payload

        entity_id, token, url = gateway_from_payload(
            payload={
                "id": "DIDINCOMPLETE123456",
                "access_token": {"id": "tok-inc"},
                "url": "https://app.digio.in/#/gateway/login/DIDINCOMPLETE123456",
            },
            identifier="customer@example.com",
        )
        assert entity_id == "DIDINCOMPLETE123456"
        assert token == "tok-inc"
        assert url.endswith("/#/gateway/login/DIDINCOMPLETE123456/customer@example.com/tok-inc")

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
        from django.core import mail

        signed_mails = [
            item for item in mail.outbox if item.subject == "Document Successfully Signed"
        ]
        assert len(signed_mails) == 1
        message = signed_mails[0]
        assert lead.customer.email in message.to
        assert "Document Successfully Signed" in message.body
        assert "Document Reference:DID1234567890ABCD" in message.body
        assert "Legal Binding: Effective Immediately" in message.body
        assert "Secured Document Management" in message.body
        assert message.attachments
        filename, content, mimetype = message.attachments[0]
        assert filename == "DID1234567890ABCD_signedFinal.pdf"
        assert content == b"%PDF-1.4 signed"
        assert mimetype == "application/pdf"

        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            again = api.generic(
                "POST",
                reverse("digio-webhook"),
                data=body,
                content_type="application/json",
                HTTP_X_DIGIO_SIGNATURE=_hmac(body),
            )
        assert again.status_code == status.HTTP_200_OK
        assert (
            len([item for item in mail.outbox if item.subject == "Document Successfully Signed"])
            == 1
        )

    def test_webhook_saves_pdf_from_document_file_data(self):
        import base64

        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SENT,
            provider_request_id="DIDFILEDATA7890ABCD",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {
            "status": "completed",
            "file_data": base64.b64encode(b"%PDF-inline").decode(),
        }

        body = b'{"event":"doc.signed","id":"DIDFILEDATA7890ABCD"}'
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
        assert row.signed_file
        mock_client.download_document.assert_not_called()

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
        from django.core import mail

        completed_mail = [
            item for item in mail.outbox if item.subject == "Video KYC Successfully Completed"
        ]
        assert completed_mail
        assert completed_mail[0].to == [lead.customer.email]
        assert "Video KYC Successfully Completed" in completed_mail[0].body
        assert "Verification Status: Approved" in completed_mail[0].body

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
            assert aadhaar_cached.get("via_digio") is True
            assert aadhaar_cached.get("otp") is None
            assert aadhaar_cached.get("unique_request_id")
            mock_client.generate_aadhaar_esign_otp.assert_called()
            verify_response = api.post(
                reverse("public-esign-verify-otp", kwargs={"pk": row.id}),
                {"otp": "654321"},
                format="json",
            )

        assert verify_response.status_code == status.HTTP_200_OK
        row.refresh_from_db()
        assert row.status == EsignRequestStatus.SIGNED
        assert row.signed_file
        assert verify_response.data["data"]["signed"] is True
        mock_client.complete_aadhaar_esign.assert_called()
        from django.core import mail

        signed_mails = [
            item for item in mail.outbox if item.subject == "Document Successfully Signed"
        ]
        assert len(signed_mails) == 1
        filename, content, _mimetype = signed_mails[0].attachments[0]
        assert filename == "DIDAADHAAROTP1234_signedFinal.pdf"
        assert content == b"%PDF-signed"

    def test_staff_can_download_signed_esign_file(self):
        from django.core.files.base import ContentFile

        admin = UserFactory(email="admin-esign-file@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SIGNED,
            provider_request_id="DIDFILE1234567890AB",
        )
        row.signed_file.save("DIDFILE1234567890AB.pdf", ContentFile(b"%PDF-staff"), save=True)

        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get(
            reverse(
                "lead-esign-request-file",
                kwargs={"pk": lead.id, "request_id": row.id},
            )
        )

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"].startswith("application/pdf")
        assert b"".join(response.streaming_content) == b"%PDF-staff"

    def test_signed_file_endpoint_retries_digio_when_pdf_missing(self):
        admin = UserFactory(email="admin-esign-retry@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SIGNED,
            provider_request_id="DIDRETRY1234567890A",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"status": "completed"}
        mock_client.download_document.return_value = b"%PDF-retry"

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(
                reverse(
                    "lead-esign-request-file",
                    kwargs={"pk": lead.id, "request_id": row.id},
                )
            )

        assert response.status_code == status.HTTP_200_OK
        assert b"".join(response.streaming_content) == b"%PDF-retry"
        row.refresh_from_db()
        assert row.signed_file

    def test_esign_list_exposes_authenticated_signed_file_url(self):
        admin = UserFactory(email="admin-esign-url@test.com")
        _assign_role(admin, "admin")
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SIGNED,
            provider_request_id="DIDURL1234567890ABCD",
        )
        mock_client = MagicMock()
        mock_client.get_document.return_value = {"status": "completed"}
        mock_client.download_document.return_value = b"%PDF-list"

        client = APIClient()
        client.force_authenticate(user=admin)
        with patch(
            "apps.integrations.digio.webhooks.DigioClient.from_settings",
            return_value=mock_client,
        ):
            response = client.get(reverse("lead-esign-requests", kwargs={"pk": lead.id}))

        assert response.status_code == status.HTTP_200_OK
        payload = response.data["data"][0]
        assert payload["status"] == "signed"
        assert f"/esign-requests/{row.id}/file/" in payload["signed_file_url"]
        row.refresh_from_db()
        assert row.signed_file

    def test_signed_esign_file_requires_auth(self):
        lead = _create_lead()
        row = LeadEsignRequest.objects.create(
            lead=lead,
            recipient_email=lead.customer.email,
            status=EsignRequestStatus.SIGNED,
            provider_request_id="DIDUNAUTH1234567890",
        )
        client = APIClient()
        response = client.get(
            reverse(
                "lead-esign-request-file",
                kwargs={"pk": lead.id, "request_id": row.id},
            )
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


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

    def test_upload_pdf_sends_sign_coordinates_keyed_by_identifier(self):
        from apps.integrations.digio.client import DigioClient

        client = DigioClient(
            base_url="https://api.digio.in", client_id="id", client_secret="secret"
        )
        boxes = {"8": [{"llx": 390, "lly": 410, "urx": 560, "ury": 535}]}
        with patch.object(client, "request", return_value={"id": "DID1"}) as request:
            client.upload_pdf(
                file_name="a.pdf",
                file_bytes=b"%PDF-1.4",
                signer_name="Test",
                identifier="test@example.com",
                sign_type="aadhaar",
                display_on_page="custom",
                sign_coordinates=boxes,
            )

        payload = request.call_args.args[2]
        assert payload["display_on_page"] == "custom"
        assert payload["sign_coordinates"] == {"test@example.com": boxes}

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

    def test_download_document_does_not_request_json(self):
        from apps.integrations.digio.client import DigioClient

        captured = {}
        client = DigioClient(
            base_url="https://api.digio.in", client_id="id", client_secret="secret"
        )
        response = MagicMock()
        response.read.return_value = b"%PDF-1.4 signed"
        response.status = 200
        response.headers = {"Content-Type": "application/pdf"}
        response.__enter__.return_value = response
        response.__exit__.return_value = False

        def fake_open(request, timeout=None):
            captured["accept"] = request.get_header("Accept")
            return response

        with patch.object(client, "_open", side_effect=fake_open):
            pdf = client.download_document("DIDPDFACCEPT1")
        assert pdf.startswith(b"%PDF")
        assert captured["accept"] == "*/*"

    def test_download_document_falls_back_to_file_data(self):
        import base64

        from apps.integrations.digio.client import DigioClient
        from apps.integrations.digio.exceptions import DigioAPIError

        encoded = base64.b64encode(b"%PDF-from-json").decode()
        client = DigioClient(
            base_url="https://api.digio.in", client_id="id", client_secret="secret"
        )

        def fake_request(method, path, payload=None, *, raw=False):
            if "download" in path:
                raise DigioAPIError("not found", status_code=404)
            return {"status": "completed", "file_data": encoded}

        with patch.object(client, "request", side_effect=fake_request):
            pdf = client.download_document("DIDFILEDATA123")
        assert pdf == b"%PDF-from-json"
