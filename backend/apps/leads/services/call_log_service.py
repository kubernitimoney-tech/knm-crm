import logging

from django.db import transaction

from apps.activities.services.activity_service import ActivityService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.collections.models import CollectionActivityType
from apps.collections.services.collection_activity_service import CollectionActivityService
from apps.leads.models import (
    CALL_LOG_IMMUTABLE_STATUSES,
    CallDisposition,
    CallLog,
    Lead,
    LeadAssignmentHistory,
    LeadCloserType,
    LeadStatus,
)
from apps.leads.services.lead_conversion_service import LeadConversionService
from apps.leads.services.lead_service import LeadService
from apps.leads.services.lead_status_service import change_lead_status

logger = logging.getLogger(__name__)


class CallLogService:
    STATUS_FROM_DISPOSITION = {
        CallDisposition.BUSY: LeadStatus.BUSY,
        CallDisposition.CALL_BACK: LeadStatus.CALL_BACK,
        CallDisposition.INTERESTED: LeadStatus.INTERESTED,
        CallDisposition.DOCUMENTS_PENDING: LeadStatus.DOCUMENTS_PENDING,
        CallDisposition.DOCUMENTS_RECEIVED: LeadStatus.DOCUMENTS_RECEIVED,
        CallDisposition.NOT_INTERESTED: LeadStatus.NOT_INTERESTED,
        CallDisposition.DUPLICATE_LEAD: LeadStatus.DUPLICATE_LEAD,
        CallDisposition.LOAN_RUNNING: LeadStatus.LOAN_RUNNING,
        CallDisposition.INVALID_NUMBER: LeadStatus.INVALID_NUMBER,
    }

    CLOSE_REASON_FROM_DISPOSITION = {
        CallDisposition.NOT_INTERESTED: LeadCloserType.NOT_INTERESTED,
    }

    @classmethod
    @transaction.atomic
    def log(cls, *, user, lead: Lead, disposition: str, remarks: str = "") -> CallLog:
        call_log = CallLog.objects.create(
            lead=lead,
            disposition=disposition,
            remarks=remarks,
            created_by=user,
        )

        new_status = cls.STATUS_FROM_DISPOSITION.get(disposition)
        if new_status and lead.status not in CALL_LOG_IMMUTABLE_STATUSES:
            updated_fields: list[str] = []

            close_reason = cls.CLOSE_REASON_FROM_DISPOSITION.get(disposition)
            if close_reason:
                lead.close_reason = close_reason
                updated_fields.append("close_reason")
            elif (
                lead.status == LeadStatus.NOT_INTERESTED and new_status != LeadStatus.NOT_INTERESTED
            ):
                if lead.close_reason:
                    lead.close_reason = ""
                    updated_fields.append("close_reason")
                if lead.rejection_reason:
                    lead.rejection_reason = ""
                    updated_fields.append("rejection_reason")

            if lead.assigned_cm is None:
                cm = LeadService.auto_assign_cm()
                if cm is not None:
                    old_cm = lead.assigned_cm
                    lead.assigned_cm = cm
                    updated_fields.append("assigned_cm")
                    LeadAssignmentHistory.objects.create(
                        lead=lead,
                        assigned_by=user,
                        old_cm=old_cm,
                        new_cm=cm,
                        remarks="Auto-assigned CM on call log status update",
                    )

            change_lead_status(
                lead=lead,
                new_status=new_status,
                user=user,
                remarks=remarks or f"Call disposition: {disposition}",
                extra_update_fields=updated_fields,
            )

            if new_status in LeadConversionService.LEAD_TO_APPLICATION_STATUS:
                try:
                    LeadConversionService.ensure_application_for_lead(user=user, lead=lead)
                except Exception:
                    logger.exception(
                        "Auto loan application sync failed for lead %s after call log (%s)",
                        lead.lead_id,
                        disposition,
                    )

        ActivityService.log(
            actor=user,
            verb="call_logged",
            description="Call Logged",
            target=lead,
            metadata={"disposition": disposition},
        )
        UserActivityService.log(
            user=user,
            action=UserActivityAction.CREATE,
            description=(f"Logged call for lead {lead.lead_id}: {disposition}"),
            metadata={
                "lead_id": str(lead.pk),
                "call_log_id": str(call_log.pk),
                "disposition": disposition,
            },
        )
        CollectionActivityService.log_for_lead(
            lead=lead,
            user=user,
            activity_type=CollectionActivityType.CALL,
            outcome=disposition,
            notes=remarks,
        )
        return call_log
