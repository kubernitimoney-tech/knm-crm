from django.db import transaction

from apps.leads.models import Lead, LeadActivity, LeadActivityType, LeadStatusHistory


@transaction.atomic
def change_lead_status(
    *,
    lead: Lead,
    new_status: str,
    user,
    remarks: str = "",
    extra_update_fields: list[str] | None = None,
) -> Lead:
    new_status = str(new_status)
    if lead.status == new_status:
        return lead

    from_status = lead.status
    lead.status = new_status
    lead.updated_by = user

    update_fields = ["status", "updated_by", "updated_at"]
    if extra_update_fields:
        for field in extra_update_fields:
            if field not in update_fields:
                update_fields.append(field)

    lead.save(update_fields=update_fields)

    LeadStatusHistory.objects.create(
        lead=lead,
        from_status=from_status,
        to_status=new_status,
        changed_by=user,
        remarks=remarks,
    )
    LeadActivity.objects.create(
        lead=lead,
        activity_type=LeadActivityType.STATUS_CHANGE,
        description=f"Status changed from {from_status} to {new_status}",
        metadata={"from_status": from_status, "to_status": new_status, "remarks": remarks},
        created_by=user,
    )
    return lead


def record_lead_status_created(
    *, lead: Lead, user, remarks: str = "Lead created"
) -> LeadStatusHistory:
    return LeadStatusHistory.objects.create(
        lead=lead,
        from_status="",
        to_status=lead.status,
        changed_by=user,
        remarks=remarks,
    )
