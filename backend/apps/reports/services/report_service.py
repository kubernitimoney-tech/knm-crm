from apps.applications.models import LoanApplication
from apps.reports.tasks import generate_loan_portfolio_report


class ReportService:
    @staticmethod
    def export_portfolio_report(*, user, filters: dict | None = None):
        filters = filters or {}
        task = generate_loan_portfolio_report.delay(str(user.id), filters)
        qs = LoanApplication.objects.filter(is_deleted=False).select_related("customer")
        if filters.get("state"):
            qs = qs.filter(current_state__slug=filters["state"])
        rows = list(
            qs.values(
                "application_number",
                "customer__customer_code",
                "requested_amount",
                "approved_amount",
                "status",
            )[:1000]
        )
        return {"task_id": task.id, "preview_rows": rows, "total": qs.count()}
