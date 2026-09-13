from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import error_response, success_response
from apps.reports.services.activity_reporting_service import (
    ActivityLogDeleteError,
    ActivityReportingService,
)
from apps.reports.services.all_reporting_service import AllReportingService
from apps.reports.services.report_service import ReportService


class ActivityReportingAccessMixin:
    permission_classes = [HasRBACPermission]
    required_permissions = ["audit.view", "report.view", "lead.view", "collection.view"]


class UserActivityReportingAPIView(ActivityReportingAccessMixin, APIView):
    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = ActivityReportingService.get_user_activity_rows(
            user=request.user, page=page, page_size=page_size
        )
        return success_response(data=data)


class AuditLogReportingAPIView(ActivityReportingAccessMixin, APIView):
    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = ActivityReportingService.get_audit_log_rows(
            user=request.user, page=page, page_size=page_size
        )
        return success_response(data=data)


class CallLogReportingAPIView(ActivityReportingAccessMixin, APIView):
    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = ActivityReportingService.get_call_log_rows(
            user=request.user, page=page, page_size=page_size
        )
        return success_response(data=data)


class LeadActivityReportingAPIView(ActivityReportingAccessMixin, APIView):
    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = ActivityReportingService.get_lead_activity_rows(
            user=request.user, page=page, page_size=page_size
        )
        return success_response(data=data)


class CollectionActivityReportingAPIView(ActivityReportingAccessMixin, APIView):
    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = ActivityReportingService.get_collection_activity_rows(
            user=request.user, page=page, page_size=page_size
        )
        return success_response(data=data)


class ActivityLogDeleteAPIView(ActivityReportingAccessMixin, APIView):
    required_permission = "audit.delete"

    def delete(self, request, log_type: str, log_id):
        try:
            ActivityReportingService.delete_activity_log_row(
                user=request.user,
                log_type=log_type,
                log_id=log_id,
            )
        except ActivityLogDeleteError as exc:
            message = str(exc)
            status_code = 404 if "not found" in message.lower() else 403
            return error_response(message=message, status_code=status_code)
        return success_response(message="Activity log record deleted")


class ReportingAccessMixin:
    """Account & finance holds disbursal.view / loan.view but not always report.view."""

    permission_classes = [HasRBACPermission]
    required_permissions = ["report.view", "disbursal.view", "loan.view"]


class GenerateReportAPIView(ReportingAccessMixin, APIView):
    required_permissions = ["report.export", "report.view", "disbursal.view", "loan.view"]

    def post(self, request):
        result = ReportService.export_portfolio_report(
            user=request.user,
            filters=request.data,
        )
        return success_response(data=result, message="Report generation started")


class ReportingFiltersAPIView(ReportingAccessMixin, APIView):
    def get(self, request):
        data = AllReportingService.get_filter_options(user=request.user)
        return success_response(data=data)


class DisbursedReportingAPIView(ReportingAccessMixin, APIView):
    """Paginated disbursed-loan rows for the All Reporting screen."""

    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = AllReportingService.get_disbursed_rows(
            user=request.user,
            page=page,
            page_size=page_size,
        )
        return success_response(data=data)


class CollectionReportingAPIView(ReportingAccessMixin, APIView):
    """Paginated collection (repayment) rows for the All Reporting screen."""

    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = AllReportingService.get_collection_rows(
            user=request.user,
            page=page,
            page_size=page_size,
        )
        return success_response(data=data)


class CibilReportingAPIView(ReportingAccessMixin, APIView):
    """Paginated CIBIL export rows derived from disbursed loans."""

    def get(self, request):
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("page_size", 50)), 1), 100)
        data = AllReportingService.get_cibil_rows(
            user=request.user,
            page=page,
            page_size=page_size,
        )
        return success_response(data=data)
