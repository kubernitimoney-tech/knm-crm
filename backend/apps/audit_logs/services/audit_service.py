from apps.audit_logs.middleware import get_audit_context
from apps.audit_logs.models import AuditLog
from apps.audit_logs.services.user_activity_service import UserActivityService


class AuditService:
    @staticmethod
    def _resolve_actor(instance, ctx_user):
        if ctx_user is not None and getattr(ctx_user, "is_authenticated", False):
            return ctx_user
        for attr in ("deleted_by", "updated_by", "created_by"):
            actor = getattr(instance, attr, None)
            if actor is not None:
                return actor
        return None

    @staticmethod
    def log_model_change(*, instance, action: str, model_name: str, before=None, after=None):
        ctx = get_audit_context()
        user = AuditService._resolve_actor(instance, ctx.get("user"))
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=str(instance.pk),
            before_data=before,
            after_data=after or AuditService._serialize(instance),
            ip_address=ctx.get("ip_address"),
            user_agent=ctx.get("user_agent", ""),
        )
        UserActivityService.log_from_audit(
            user=user,
            instance=instance,
            audit_action=action,
            model_name=model_name,
        )

    @staticmethod
    def _serialize(instance) -> dict:
        from decimal import Decimal

        data = {}
        for field in instance._meta.fields:
            if field.name in ("password",):
                continue
            if field.many_to_one or field.one_to_one:
                val = getattr(instance, field.attname)
            else:
                val = getattr(instance, field.name)
            if val is None:
                pass
            elif hasattr(val, "isoformat"):
                val = val.isoformat()
            elif isinstance(val, Decimal):
                val = str(val)
            elif hasattr(val, "hex"):  # UUID
                val = str(val)
            elif hasattr(val, "pk"):  # unexpected related model
                val = str(val.pk)
            data[field.name] = val
        return data
