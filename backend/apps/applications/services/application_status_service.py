from django.db import transaction
from django.utils import timezone

from apps.applications.models import ApplicationStatusHistory, LoanApplication


def ensure_application_submitted_at(application: LoanApplication) -> bool:
    if application.submitted_at:
        return False
    application.submitted_at = timezone.now()
    return True


@transaction.atomic
def change_application_status(
    *,
    application: LoanApplication,
    new_status: str,
    user,
    remarks: str = "",
    extra_update_fields: list[str] | None = None,
) -> LoanApplication:
    new_status = str(new_status)
    if application.status == new_status:
        if extra_update_fields:
            application.updated_by = user
            update_fields = ["updated_by", "updated_at"]
            for field in extra_update_fields:
                if field not in update_fields:
                    update_fields.append(field)
            application.save(update_fields=update_fields)
        return application

    from_status = application.status
    application.status = new_status
    application.updated_by = user

    update_fields = ["status", "updated_by", "updated_at"]
    if extra_update_fields:
        for field in extra_update_fields:
            if field not in update_fields:
                update_fields.append(field)

    application.save(update_fields=update_fields)

    ApplicationStatusHistory.objects.create(
        application=application,
        from_status=from_status,
        to_status=new_status,
        changed_by=user,
        remarks=remarks,
    )
    return application


def record_application_status_created(
    *,
    application: LoanApplication,
    user,
    remarks: str = "Application created",
) -> ApplicationStatusHistory:
    return ApplicationStatusHistory.objects.create(
        application=application,
        from_status="",
        to_status=application.status,
        changed_by=user,
        remarks=remarks,
    )
