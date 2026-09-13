from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views.permission_admin_views import (
    PermissionCatalogAPIView,
    PermissionCatalogDetailAPIView,
    UserPermissionInventoryAPIView,
)
from apps.accounts.views.permission_views import (
    DeletePermissionGrantAPIView,
    GrantPermissionAPIView,
    RevokePermissionAPIView,
)
from apps.accounts.views.role_admin_views import RoleAssigneesAPIView, RoleDirectoryAPIView
from apps.accounts.views.role_permission_views import (
    GrantRolePermissionAPIView,
    PermissionMatrixAPIView,
    PermissionMatrixAuditAPIView,
    RevokeRolePermissionAPIView,
)
from apps.accounts.views.role_views import RoleViewSet
from apps.accounts.views.user_views import UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = [
    path("permissions/catalog/", PermissionCatalogAPIView.as_view(), name="permission-catalog"),
    path(
        "permissions/catalog/<uuid:permission_id>/",
        PermissionCatalogDetailAPIView.as_view(),
        name="permission-catalog-detail",
    ),
    path("permissions/matrix/", PermissionMatrixAPIView.as_view(), name="permission-matrix"),
    path(
        "permissions/matrix/audit/",
        PermissionMatrixAuditAPIView.as_view(),
        name="permission-matrix-audit",
    ),
    path(
        "roles/directory/",
        RoleDirectoryAPIView.as_view(),
        name="role-directory",
    ),
    path(
        "roles/<slug:role_slug>/assignees/",
        RoleAssigneesAPIView.as_view(),
        name="role-assignees",
    ),
    path(
        "roles/<slug:role_slug>/permissions/grant/",
        GrantRolePermissionAPIView.as_view(),
        name="role-permission-grant",
    ),
    path(
        "roles/<slug:role_slug>/permissions/revoke/",
        RevokeRolePermissionAPIView.as_view(),
        name="role-permission-revoke",
    ),
    path("permissions/grant/", GrantPermissionAPIView.as_view(), name="permission-grant"),
    path("permissions/revoke/", RevokePermissionAPIView.as_view(), name="permission-revoke"),
    path(
        "permissions/grants/<uuid:grant_id>/",
        DeletePermissionGrantAPIView.as_view(),
        name="permission-grant-delete",
    ),
    path(
        "users/<uuid:user_id>/permissions/",
        UserPermissionInventoryAPIView.as_view(),
        name="user-permission-inventory",
    ),
    path("", include(router.urls)),
]
