"""
AuditContextMiddleware — attaches request metadata for audit logging.

Flow:
1. Request enters → middleware stores IP and User-Agent on thread-local context.
2. Service/signal writes AuditLog using AuditService.get_context().
3. Response returns — context cleared.
"""

import threading

_thread_locals = threading.local()


def set_audit_context(request):
    from apps.audit_logs.services.user_activity_service import reset_user_activity_logged_flag

    reset_user_activity_logged_flag()
    _thread_locals.ip_address = _get_client_ip(request)
    _thread_locals.user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
    _thread_locals.user = getattr(request, "user", None)


def update_audit_user(user):
    """Refresh audit actor after DRF JWT authentication runs."""
    if user is not None and getattr(user, "is_authenticated", False):
        _thread_locals.user = user


def clear_audit_context():
    from apps.core.soft_delete_context import clear_soft_delete_marks

    clear_soft_delete_marks()
    for attr in ("ip_address", "user_agent", "user"):
        if hasattr(_thread_locals, attr):
            delattr(_thread_locals, attr)


def get_audit_context():
    return {
        "ip_address": getattr(_thread_locals, "ip_address", None),
        "user_agent": getattr(_thread_locals, "user_agent", ""),
        "user": getattr(_thread_locals, "user", None),
    }


def _get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_audit_context(request)
        try:
            return self.get_response(request)
        finally:
            clear_audit_context()


class UserActivityLoggingMiddleware:
    """Logs mutating API requests when no other user-activity entry was recorded."""

    MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
    SKIP_PATH_PREFIXES = (
        "/api/v1/audit-logs/user-activity/log/",
        "/api/v1/accounts/auth/login/",
        "/api/v1/accounts/auth/logout/",
        "/api/v1/accounts/auth/token/refresh/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.method not in self.MUTATING_METHODS:
            return response
        if not 200 <= response.status_code < 300:
            return response
        if not request.path.startswith("/api/"):
            return response
        if any(request.path.startswith(prefix) for prefix in self.SKIP_PATH_PREFIXES):
            return response

        from apps.audit_logs.services.user_activity_service import (
            UserActivityService,
            user_activity_was_logged,
        )

        if user_activity_was_logged():
            return response

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return response

        UserActivityService.log_api_fallback(
            user=user,
            method=request.method,
            path=request.path,
        )
        return response
