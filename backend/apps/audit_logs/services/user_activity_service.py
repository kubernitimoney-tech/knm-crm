import threading

from apps.audit_logs.middleware import get_audit_context
from apps.audit_logs.models import UserActivityAction, UserActivityLog

_activity_thread = threading.local()

AUDIT_TO_USER_ACTION = {
    "create": UserActivityAction.CREATE,
    "update": UserActivityAction.UPDATE,
    "delete": UserActivityAction.DELETE,
}


def reset_user_activity_logged_flag() -> None:
    _activity_thread.logged = False


def mark_user_activity_logged() -> None:
    _activity_thread.logged = True


def user_activity_was_logged() -> bool:
    return bool(getattr(_activity_thread, "logged", False))


class UserActivityService:
    @staticmethod
    def log(*, user, action: str, description: str, metadata: dict | None = None):
        ctx = get_audit_context()
        row = UserActivityLog.objects.create(
            user=user,
            action=action,
            description=description[:255],
            ip_address=ctx.get("ip_address"),
            user_agent=ctx.get("user_agent", ""),
            metadata=metadata or {},
        )
        mark_user_activity_logged()
        return row

    @staticmethod
    def resolve_user(user, instance=None):
        if user is not None and getattr(user, "is_authenticated", False):
            return user
        if instance is not None:
            return (
                getattr(instance, "deleted_by", None)
                or getattr(instance, "updated_by", None)
                or getattr(instance, "created_by", None)
            )
        ctx_user = get_audit_context().get("user")
        if ctx_user is not None and getattr(ctx_user, "is_authenticated", False):
            return ctx_user
        return None

    @staticmethod
    def instance_label(instance) -> str:
        for attr in (
            "application_number",
            "lead_id",
            "customer_code",
            "loan_account_number",
            "email",
            "code",
        ):
            val = getattr(instance, attr, None)
            if val:
                return str(val)
        if hasattr(instance, "amount"):
            amount = getattr(instance, "amount", None)
            if amount is not None:
                return str(amount)
        return str(instance.pk)[:12]

    @classmethod
    def log_for_model(
        cls,
        *,
        user,
        action: str,
        instance,
        description: str | None = None,
        metadata: dict | None = None,
    ):
        actor = cls.resolve_user(user, instance)
        if actor is None:
            return None
        model_label = instance._meta.verbose_name
        object_label = cls.instance_label(instance)
        action_label = str(action).replace("_", " ").title()
        desc = description or f"{action_label} {model_label}: {object_label}"
        meta = {
            "model": instance._meta.label,
            "object_id": str(instance.pk),
            **(metadata or {}),
        }
        return cls.log(user=actor, action=action, description=desc, metadata=meta)

    @classmethod
    def log_from_audit(cls, *, user, instance, audit_action: str, model_name: str | None = None):
        user_action = AUDIT_TO_USER_ACTION.get(audit_action, UserActivityAction.UPDATE)
        model_label = model_name or instance._meta.verbose_name
        return cls.log_for_model(
            user=user,
            action=user_action,
            instance=instance,
            description=f"{user_action.label} {model_label}: {cls.instance_label(instance)}",
            metadata={"source": "audit", "audit_action": audit_action},
        )

    @classmethod
    def log_api_fallback(cls, *, user, method: str, path: str):
        action = {
            "POST": UserActivityAction.CREATE,
            "PUT": UserActivityAction.UPDATE,
            "PATCH": UserActivityAction.UPDATE,
            "DELETE": UserActivityAction.DELETE,
        }.get(method.upper(), UserActivityAction.UPDATE)
        return cls.log(
            user=user,
            action=action,
            description=f"{action.label} via API: {method} {path}"[:255],
            metadata={"source": "api_fallback", "method": method, "path": path},
        )
