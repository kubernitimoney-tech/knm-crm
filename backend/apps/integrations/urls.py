from django.urls import path

from apps.integrations.cashfree.views import CashfreeWebhookAPIView
from apps.integrations.digio.views import DigioWebhookAPIView

urlpatterns = [
    path("digio/", DigioWebhookAPIView.as_view(), name="digio-webhook"),
    # Cashfree's dashboard test posts to the URL with no trailing slash.
    path("cashfree", CashfreeWebhookAPIView.as_view(), name="cashfree-webhook-noslash"),
    path("cashfree/", CashfreeWebhookAPIView.as_view(), name="cashfree-webhook"),
]
