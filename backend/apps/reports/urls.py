from django.urls import path

from apps.reports.views.report_views import (
    ActivityLogDeleteAPIView,
    AuditLogReportingAPIView,
    CallLogReportingAPIView,
    CibilReportingAPIView,
    CollectionActivityReportingAPIView,
    CollectionReportingAPIView,
    DisbursedReportingAPIView,
    GenerateReportAPIView,
    LeadActivityReportingAPIView,
    ReportingFiltersAPIView,
    UserActivityReportingAPIView,
)

urlpatterns = [
    path("portfolio/", GenerateReportAPIView.as_view(), name="report-portfolio"),
    path("filters/", ReportingFiltersAPIView.as_view(), name="report-filters"),
    path("disbursed/", DisbursedReportingAPIView.as_view(), name="report-disbursed"),
    path("collection/", CollectionReportingAPIView.as_view(), name="report-collection"),
    path("cibil/", CibilReportingAPIView.as_view(), name="report-cibil"),
    path("activity/user/", UserActivityReportingAPIView.as_view(), name="report-activity-user"),
    path("activity/audit/", AuditLogReportingAPIView.as_view(), name="report-activity-audit"),
    path(
        "activity/call-logs/", CallLogReportingAPIView.as_view(), name="report-activity-call-logs"
    ),
    path("activity/lead/", LeadActivityReportingAPIView.as_view(), name="report-activity-lead"),
    path(
        "activity/collection/",
        CollectionActivityReportingAPIView.as_view(),
        name="report-activity-collection",
    ),
    path(
        "activity/<str:log_type>/<uuid:log_id>/",
        ActivityLogDeleteAPIView.as_view(),
        name="report-activity-delete",
    ),
]
