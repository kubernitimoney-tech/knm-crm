"""Re-check Video KYC rows marked Completed against Digio.

Before the fix, a customer who finished step 1 (OTP + DigiLocker) and quit
before recording the video could be marked Completed. This command asks Digio
for each Completed row and moves any with an unfinished step to Video Pending.

    python manage.py recheck_video_kyc            # report only
    python manage.py recheck_video_kyc --apply    # update rows
"""

from django.core.management.base import BaseCommand

from apps.integrations.digio.client import DigioClient
from apps.integrations.digio.exceptions import DigioError
from apps.integrations.digio.webhooks import (
    KYC_PROGRESS_COMPLETED,
    _kyc_progress,
    _kyc_steps,
    _unwrap_kyc_response,
)
from apps.leads.models import LeadVideoKycRequest, VideoKycRequestStatus


class Command(BaseCommand):
    help = "Move Video KYC rows wrongly marked Completed back to Video Pending."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Save the changes.")

    def handle(self, *args, apply=False, **options):
        client = DigioClient.from_settings()
        rows = LeadVideoKycRequest.objects.filter(
            status=VideoKycRequestStatus.COMPLETED,
        ).exclude(provider_request_id="")
        checked = moved = 0
        for row in rows.select_related("lead"):
            checked += 1
            try:
                response = _unwrap_kyc_response(client.get_kyc_response(row.provider_request_id))
            except DigioError as exc:
                self.stdout.write(self.style.WARNING(f"{row.lead.lead_id}: Digio error {exc}"))
                continue
            if _kyc_progress(response) == KYC_PROGRESS_COMPLETED:
                continue
            moved += 1
            steps = ", ".join(f"{s['type']}={s['status'] or '?'}" for s in _kyc_steps(response))
            self.stdout.write(f"{row.lead.lead_id} {row.provider_request_id}: {steps}")
            if apply:
                details = dict(row.session_details or {})
                details["steps"] = _kyc_steps(response)
                details["rechecked"] = True
                row.status = VideoKycRequestStatus.VIDEO_PENDING
                row.completed_at = None
                row.session_details = details
                row.save(update_fields=["status", "completed_at", "session_details", "updated_at"])
        verb = "Moved" if apply else "Would move"
        self.stdout.write(
            self.style.SUCCESS(f"Checked {checked}. {verb} {moved} to Video Pending.")
        )
