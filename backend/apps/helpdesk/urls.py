from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.helpdesk.views import TicketCategoryViewSet, TicketViewSet

router = DefaultRouter()
router.register("categories", TicketCategoryViewSet, basename="helpdesk-category")
router.register("tickets", TicketViewSet, basename="helpdesk-ticket")

urlpatterns = [
    path("", include(router.urls)),
]
