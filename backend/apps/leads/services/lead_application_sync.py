from apps.applications.models import ApplicationStatus, LoanApplication
from apps.leads.models import Lead


def sync_application_lead_link(application: LoanApplication) -> LoanApplication:
    """Ensure application.lead matches lead.converted_application when missing."""
    if application.lead_id:
        return application
    lead = Lead.objects.filter(
        converted_application_id=application.pk,
        is_deleted=False,
    ).first()
    if not lead:
        return application
    application.lead = lead
    application.save(update_fields=["lead", "updated_at"])
    return application


def backfill_missing_application_lead_links(*, statuses: frozenset[str] | None = None) -> int:
    """Repair applications missing lead FK but referenced by lead.converted_application."""
    statuses = statuses or frozenset({ApplicationStatus.DISBURSED})
    updated = 0
    apps = LoanApplication.objects.filter(
        is_deleted=False,
        lead_id__isnull=True,
        status__in=statuses,
    )
    for application in apps.iterator():
        before = application.lead_id
        sync_application_lead_link(application)
        if application.lead_id and application.lead_id != before:
            updated += 1
    return updated
