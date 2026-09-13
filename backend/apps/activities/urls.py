from django.urls import path

from apps.activities.views.activity_views import ActivityTimelineAPIView

urlpatterns = [
    path("timeline/", ActivityTimelineAPIView.as_view(), name="activity-timeline"),
]
