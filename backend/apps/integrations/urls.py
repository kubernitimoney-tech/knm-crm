from django.urls import path

from apps.integrations.digio.views import DigioWebhookAPIView

urlpatterns = [
    path("digio/", DigioWebhookAPIView.as_view(), name="digio-webhook"),
]
