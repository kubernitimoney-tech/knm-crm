from django.shortcuts import get_object_or_404
from django.urls import path
from rest_framework.views import APIView

from apps.core.responses import success_response
from apps.notifications.models import Notification


def _serialize_notification(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "title": notification.title,
        "body": notification.body,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


class NotificationListAPIView(APIView):
    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)
        unread_count = qs.filter(is_read=False).count()
        items = qs.order_by("-created_at")[:50]
        data = [_serialize_notification(n) for n in items]
        return success_response(data={"notifications": data, "unread_count": unread_count})


class NotificationUnreadCountAPIView(APIView):
    def get(self, request):
        unread_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()
        return success_response(data={"unread_count": unread_count})


class NotificationMarkReadAPIView(APIView):
    def post(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user,
        )
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return success_response(data=_serialize_notification(notification))


class NotificationMarkAllReadAPIView(APIView):
    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        return success_response(data={"updated": updated})


urlpatterns = [
    path("", NotificationListAPIView.as_view(), name="notifications"),
    path(
        "unread-count/", NotificationUnreadCountAPIView.as_view(), name="notifications-unread-count"
    ),
    path("read-all/", NotificationMarkAllReadAPIView.as_view(), name="notifications-read-all"),
    path(
        "<uuid:notification_id>/read/",
        NotificationMarkReadAPIView.as_view(),
        name="notification-mark-read",
    ),
]
