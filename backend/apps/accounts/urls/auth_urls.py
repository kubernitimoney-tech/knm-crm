from django.urls import path

from apps.accounts.views.auth_views import (
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    RefreshTokenAPIView,
)

urlpatterns = [
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("refresh/", RefreshTokenAPIView.as_view(), name="auth-refresh"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
]
