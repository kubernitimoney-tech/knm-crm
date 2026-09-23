from django.urls import include, path

from apps.core.views import HealthCheckAPIView

urlpatterns = [
    path("health/", HealthCheckAPIView.as_view(), name="health-check"),
    path("core/", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls.auth_urls")),
    path("accounts/", include("apps.accounts.urls.account_urls")),
    path("customers/", include("apps.customers.urls")),
    path("leads/", include("apps.leads.urls")),
    path("applications/", include("apps.applications.urls")),
    path("loans/", include("apps.loans.urls")),
    path("documents/", include("apps.documents.urls")),
    path("workflow/", include("apps.workflow.urls")),
    path("activities/", include("apps.activities.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("audit-logs/", include("apps.audit_logs.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("organization/", include("apps.organization.urls")),
    path("reports/", include("apps.reports.urls")),
    path("webhooks/", include("apps.integrations.urls")),
]
