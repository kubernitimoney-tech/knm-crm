"""Video KYC must be Completed only when Digio reports every step done.

Step 1: OTP + DigiLocker documents. Step 2: 1-minute video recording.
A customer who finishes step 1 and quits is Video Pending, not Completed.
"""

from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import customer_factory

from apps.integrations.digio.exceptions import DigioAPIError
from apps.integrations.digio.webhooks import (
    KYC_PROGRESS_COMPLETED,
    KYC_PROGRESS_NONE,
    KYC_PROGRESS_PARTIAL,
    _kyc_progress,
    process_webhook_payload,
)
from apps.leads.models import Lead, LeadSource, LeadVideoKycRequest, VideoKycRequestStatus

STEP1_DONE_VIDEO_PENDING = {
    "id": "KIDPARTIAL1234567",
    "status": "requested",
    "actions": [
        {
            "type": "digilocker",
            "status": "success",
            "action_data": {"aadhaar_number": "XXXX1234", "name": "Test User"},
        },
        {"type": "video", "status": "requested"},
    ],
}
BOTH_DONE = {
    "id": "KIDPARTIAL1234567",
    "status": "approval_pending",
    "actions": [
        {"type": "digilocker", "status": "success"},
        {"type": "video", "status": "success"},
    ],
}


@pytest.fixture
def row(db):
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    lead = Lead.objects.create(lead_id="VKYC0001", customer=customer_factory(), source=source)
    return LeadVideoKycRequest.objects.create(
        lead=lead,
        status=VideoKycRequestStatus.SENT,
        provider_request_id="KIDPARTIAL1234567",
    )


def _sync(row, response=None, error=None):
    client = MagicMock()
    if error is not None:
        client.get_kyc_response.side_effect = error
    else:
        client.get_kyc_response.return_value = response
    with patch("apps.integrations.digio.webhooks.DigioClient.from_settings", return_value=client):
        return APIClient().get(
            reverse("public-video-kyc", kwargs={"pk": row.id}), {"sync": "1", "force": "1"}
        )


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (STEP1_DONE_VIDEO_PENDING, KYC_PROGRESS_PARTIAL),
        (BOTH_DONE, KYC_PROGRESS_COMPLETED),
        ({"status": "approved"}, KYC_PROGRESS_COMPLETED),
        ({"status": "partially_completed"}, KYC_PROGRESS_PARTIAL),
        (
            {"status": "requested", "actions": [{"type": "digilocker", "status": "requested"}]},
            KYC_PROGRESS_NONE,
        ),
    ],
)
def test_kyc_progress(response, expected):
    assert _kyc_progress(response) == expected


def test_quitting_after_step_one_is_video_pending_not_completed(row):
    response = _sync(row, STEP1_DONE_VIDEO_PENDING)
    assert response.status_code == status.HTTP_200_OK
    assert response.data["data"]["completed"] is False
    row.refresh_from_db()
    assert row.status == VideoKycRequestStatus.VIDEO_PENDING
    assert row.get_status_display() == "Video Pending"
    assert row.completed_at is None
    # Step 1 is kept on record.
    assert row.session_details["steps"][0] == {"type": "digilocker", "status": "success"}
    assert row.session_details["aadhaar_details"]
    from django.core import mail

    assert not any("Completed" in item.subject for item in mail.outbox)


def test_completing_the_video_marks_completed(row):
    _sync(row, STEP1_DONE_VIDEO_PENDING)
    response = _sync(row, BOTH_DONE)
    assert response.data["data"]["completed"] is True
    row.refresh_from_db()
    assert row.status == VideoKycRequestStatus.COMPLETED
    assert row.completed_at is not None


def test_digio_error_on_forced_sync_does_not_complete(row):
    _sync(row, error=DigioAPIError("timeout"))
    row.refresh_from_db()
    assert row.status == VideoKycRequestStatus.SENT


def test_step_level_webhook_event_does_not_complete(row):
    client = MagicMock()
    client.get_kyc_response.return_value = STEP1_DONE_VIDEO_PENDING
    with patch("apps.integrations.digio.webhooks.DigioClient.from_settings", return_value=client):
        process_webhook_payload({"event": "kyc.action.completed", "id": "KIDPARTIAL1234567"})
    row.refresh_from_db()
    assert row.status == VideoKycRequestStatus.VIDEO_PENDING
