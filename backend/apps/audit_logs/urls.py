from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit_logs.views.audit_views import AuditLogViewSet
from apps.audit_logs.views.user_activity_views import LogUserActivityAPIView, UserActivityLogViewSet

router = DefaultRouter()
router.register("", AuditLogViewSet, basename="audit-log")
router.register("user-activity", UserActivityLogViewSet, basename="user-activity-log")

urlpatterns = [
    path("user-activity/log/", LogUserActivityAPIView.as_view(), name="log-user-activity"),
    path("", include(router.urls)),
]
