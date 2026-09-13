from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.organization.views import BankHolidayViewSet

router = DefaultRouter()
router.register("bank-holidays", BankHolidayViewSet, basename="bank-holiday")

urlpatterns = [
    path("", include(router.urls)),
]
