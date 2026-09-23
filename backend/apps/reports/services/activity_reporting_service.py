"""Paginated activity log rows for reporting screens."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.services.role_helpers import (
    is_account_finance,
    is_admin_user,
    is_super_admin,
    user_has_permission,
)
from apps.audit_logs.models import AuditLog, UserActivityAction, UserActivityLog
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.collections.models import CollectionActivity
from apps.leads.models import CallLog, LeadActivity


class ActivityLogDeleteError(Exception):
    pass


ACTIVITY_LOG_TYPE_MAP = {
    "user": UserActivityLog,
    "audit": AuditLog,
    "call-logs": CallLog,
    "lead": LeadActivity,
    "collection": CollectionActivity,
}


def _user_label(user) -> str:
    if user is None:
        return "—"
    name = " ".join(
        filter(None, [getattr(user, "first_name", ""), getattr(user, "last_name", "")])
    ).strip()
    return name or getattr(user, "email", "") or "—"


def _hydrate_audit_log_users(rows):
    User = get_user_model()
    actors_by_id: dict[str, object] = {}

    for row in rows:
        if row.user_id and row.user:
            actors_by_id[str(row.user_id)] = row.user

    missing_ids: set[str] = set()
    for row in rows:
        if row.user_id and row.user:
            continue
        after_data = row.after_data if isinstance(row.after_data, dict) else {}
        user_id = after_data.get("updated_by") or after_data.get("created_by")
        if user_id and str(user_id) not in actors_by_id:
            missing_ids.add(str(user_id))

    if missing_ids:
        for user in User.objects.filter(pk__in=missing_ids):
            actors_by_id[str(user.pk)] = user

    hydrated = []
    for row in rows:
        actor = row.user if row.user_id and row.user else None
        if actor is None:
            after_data = row.after_data if isinstance(row.after_data, dict) else {}
            user_id = after_data.get("updated_by") or after_data.get("created_by")
            if user_id:
                actor = actors_by_id.get(str(user_id))
        hydrated.append((row, actor))
    return hydrated


def _can_view_all_activity(user) -> bool:
    return is_super_admin(user) or is_admin_user(user) or is_account_finance(user)


class ActivityReportingService:
    @staticmethod
    def _paginate_qs(qs, *, page: int, page_size: int):
        total = qs.count()
        start = (page - 1) * page_size
        return total, list(qs[start : start + page_size])

    @staticmethod
    def get_user_activity_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = UserActivityLog.objects.select_related("user").order_by("-created_at")
        if not _can_view_all_activity(user):
            qs = qs.filter(user=user)
        total, items = ActivityReportingService._paginate_qs(qs, page=page, page_size=page_size)
        return {
            "count": total,
            "results": [
                {
                    "id": str(row.id),
                    "userEmail": getattr(row.user, "email", None) or "—",
                    "userName": _user_label(row.user),
                    "action": row.action,
                    "description": row.description,
                    "ipAddress": row.ip_address or "—",
                    "createdAt": row.created_at.isoformat() if row.created_at else "",
                }
                for row in items
            ],
        }

    @staticmethod
    def get_audit_log_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = AuditLog.objects.select_related("user").order_by("-created_at")
        total, items = ActivityReportingService._paginate_qs(qs, page=page, page_size=page_size)
        hydrated = _hydrate_audit_log_users(items)
        return {
            "count": total,
            "results": [
                {
                    "id": str(row.id),
                    "userEmail": getattr(actor, "email", None) or "—",
                    "userName": _user_label(actor),
                    "action": row.action,
                    "modelName": row.model_name,
                    "objectId": row.object_id,
                    "ipAddress": row.ip_address or "—",
                    "createdAt": row.created_at.isoformat() if row.created_at else "",
                }
                for row, actor in hydrated
            ],
        }

    @staticmethod
    def get_call_log_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = CallLog.objects.select_related("lead", "created_by").order_by("-created_at")
        if not _can_view_all_activity(user):
            qs = qs.filter(created_by=user)
        total, items = ActivityReportingService._paginate_qs(qs, page=page, page_size=page_size)
        return {
            "count": total,
            "results": [
                {
                    "id": str(row.id),
                    "leadId": str(row.lead_id),
                    "leadCode": getattr(row.lead, "lead_id", "") or "—",
                    "disposition": row.disposition,
                    "remarks": row.remarks or "—",
                    "loggedBy": _user_label(row.created_by),
                    "loggedByEmail": getattr(row.created_by, "email", None) or "—",
                    "createdAt": row.created_at.isoformat() if row.created_at else "",
                }
                for row in items
            ],
        }

    @staticmethod
    def get_lead_activity_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = LeadActivity.objects.select_related("lead", "created_by").order_by("-created_at")
        if not _can_view_all_activity(user):
            qs = qs.filter(created_by=user)
        total, items = ActivityReportingService._paginate_qs(qs, page=page, page_size=page_size)
        return {
            "count": total,
            "results": [
                {
                    "id": str(row.id),
                    "leadId": str(row.lead_id),
                    "leadCode": getattr(row.lead, "lead_id", "") or "—",
                    "activityType": row.activity_type,
                    "description": row.description,
                    "createdBy": _user_label(row.created_by),
                    "createdByEmail": getattr(row.created_by, "email", None) or "—",
                    "createdAt": row.created_at.isoformat() if row.created_at else "",
                }
                for row in items
            ],
        }

    @staticmethod
    def get_collection_activity_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = CollectionActivity.objects.select_related(
            "case",
            "case__loan",
            "case__loan__customer",
            "performed_by",
        ).order_by("-performed_at")
        if not _can_view_all_activity(user):
            qs = qs.filter(performed_by=user)
        total, items = ActivityReportingService._paginate_qs(qs, page=page, page_size=page_size)
        return {
            "count": total,
            "results": [
                {
                    "id": str(row.id),
                    "loanAccount": getattr(row.case.loan, "loan_account_number", "") or "—",
                    "customerName": getattr(row.case.loan.customer, "full_name", "—")
                    if getattr(row.case, "loan", None) and getattr(row.case.loan, "customer", None)
                    else "—",
                    "activityType": row.activity_type,
                    "outcome": row.outcome or "—",
                    "notes": row.notes or "—",
                    "nextFollowUp": row.next_follow_up.isoformat() if row.next_follow_up else "",
                    "performedBy": _user_label(row.performed_by),
                    "performedByEmail": getattr(row.performed_by, "email", None) or "—",
                    "performedAt": row.performed_at.isoformat() if row.performed_at else "",
                }
                for row in items
            ],
        }

    @staticmethod
    def delete_activity_log_row(*, user, log_type: str, log_id) -> None:
        if not user_has_permission(user, "audit.delete"):
            raise ActivityLogDeleteError(
                "You do not have permission to delete activity log records."
            )

        model = ACTIVITY_LOG_TYPE_MAP.get(log_type)
        if model is None:
            raise ActivityLogDeleteError("Unknown activity log type.")

        deleted, _ = model.objects.filter(pk=log_id).delete()
        if deleted == 0:
            raise ActivityLogDeleteError("Activity log record not found.")

        UserActivityService.log(
            user=user,
            action=UserActivityAction.DELETE,
            description=f"Deleted {log_type} activity log record {log_id}",
            metadata={"log_type": log_type, "log_id": str(log_id)},
        )
