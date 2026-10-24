from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from apps.core.media import signed_media_view

urlpatterns = [
    path("knm-admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
    # Uploaded files are only served through signed, expiring links.
    path(f"{settings.MEDIA_URL.strip('/')}/<path:path>", signed_media_view, name="signed-media"),
]

try:
    if settings.DEBUG:
        import debug_toolbar

        urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
except ImportError:
    pass
