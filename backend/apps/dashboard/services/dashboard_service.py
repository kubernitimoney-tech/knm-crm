import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.dashboard.models import BranchSanctionTarget, OfficerSanctionTarget
from apps.leads.models import LeadCategory
from apps.loans.models import Loan

User = get_user_model()

PERIOD_LABELS = {
    "All Time": "All Time",
    "Today": "Today",
    "Last 7 Days": "Last 7 Days",
    "Current Month": "Current Month",
    "Custom": "Custom Range",
}


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def resolve_dashboard_date_range(
    period: str,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[date, date, str]:
    today = timezone.localdate()

    if period == "Today":
        return today, today, PERIOD_LABELS["Today"]
    if period == "Last 7 Days":
        return today - timedelta(days=6), today, PERIOD_LABELS["Last 7 Days"]
    if period == "Current Month":
        return today.replace(day=1), today, PERIOD_LABELS["Current Month"]
    if period == "All Time":
        return date(2000, 1, 1), today, PERIOD_LABELS["All Time"]
    if period == "Custom":
        start = _parse_date(date_from)
        end = _parse_date(date_to)
        if start and end and start <= end:
            return start, end, PERIOD_LABELS["Custom"]
    return today.replace(day=1), today, PERIOD_LABELS["Current Month"]


def _month_overlaps_range(year: int, month: int, start: date, end: date) -> bool:
    month_start = date(year, month, 1)
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    return month_end >= start and month_start <= end


def _decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _pct(achievement: Decimal, target: Decimal) -> float:
    if target <= 0:
        return 0.0
    return float((achievement / target * Decimal("100")).quantize(Decimal("0.1")))


def _deficit(target: Decimal, achievement: Decimal) -> Decimal:
    gap = target - achievement
    return gap if gap > 0 else Decimal("0")


def _user_label(user) -> str:
    if not user:
        return "—"
    full = user.get_full_name().strip() if hasattr(user, "get_full_name") else ""
    return full or user.email or "—"


class DashboardService:
    @staticmethod
    def get_summary():
        from apps.applications.models import LoanApplication
        from apps.customers.models import Customer
        from apps.loans.models import Loan, LoanStatus

        state_counts = (
            LoanApplication.objects.filter(is_deleted=False)
            .values("current_state__slug")
            .annotate(count=Count("id"))
        )
        return {
            "customers": Customer.objects.filter(is_deleted=False).count(),
            "applications": LoanApplication.objects.filter(is_deleted=False).count(),
            "active_loans": Loan.objects.filter(status=LoanStatus.ACTIVE, is_deleted=False).count(),
            "total_disbursed": Loan.objects.filter(is_deleted=False).aggregate(
                total=Sum("principal_amount")
            )["total"]
            or 0,
            "applications_by_state": {
                row["current_state__slug"]: row["count"]
                for row in state_counts
                if row["current_state__slug"]
            },
        }

    @staticmethod
    def get_tables(
        *,
        period: str = "Current Month",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        start, end, period_label = resolve_dashboard_date_range(
            period,
            date_from=date_from,
            date_to=date_to,
        )

        loans_qs = Loan.objects.filter(
            is_deleted=False,
            disbursed_at__isnull=False,
            disbursed_at__date__gte=start,
            disbursed_at__date__lte=end,
        ).select_related(
            "application",
            "application__lead",
            "application__assigned_cm",
            "application__lead__assigned_cm",
            "application__branch",
            "branch",
        )

        officer_achievement: dict[str, dict] = {}
        branch_achievement: dict[str, dict] = {}
        fresh_repeat: dict[str, dict] = {}

        officer_agg = (
            loans_qs.annotate(
                officer_id=Coalesce(
                    "application__assigned_cm_id",
                    "application__lead__assigned_cm_id",
                ),
            )
            .filter(officer_id__isnull=False)
            .values("officer_id")
            .annotate(
                achievement=Sum("principal_amount"),
                fresh_cases=Count(
                    "id",
                    filter=Q(application__lead__category=LeadCategory.FRESH),
                ),
                fresh_loan_amount=Sum(
                    "principal_amount",
                    filter=Q(application__lead__category=LeadCategory.FRESH),
                ),
                repeat_cases=Count(
                    "id",
                    filter=Q(application__lead__category=LeadCategory.RELOAN),
                ),
                repeat_loan_amount=Sum(
                    "principal_amount",
                    filter=Q(application__lead__category=LeadCategory.RELOAN),
                ),
            )
        )
        officer_ids = [row["officer_id"] for row in officer_agg]
        officers_by_id = {str(user.id): user for user in User.objects.filter(id__in=officer_ids)}

        for row in officer_agg:
            officer_id = str(row["officer_id"])
            officer = officers_by_id.get(officer_id)
            label = _user_label(officer)
            achievement = _decimal(row["achievement"])
            officer_achievement[officer_id] = {
                "id": officer_id,
                "officer": label,
                "achievement": achievement,
            }
            fresh_cases = row["fresh_cases"] or 0
            repeat_cases = row["repeat_cases"] or 0
            fresh_amount = _decimal(row["fresh_loan_amount"])
            repeat_amount = _decimal(row["repeat_loan_amount"])
            fresh_repeat[officer_id] = {
                "id": officer_id,
                "officer": label,
                "fresh_cases": fresh_cases,
                "fresh_loan_amount": fresh_amount,
                "repeat_cases": repeat_cases,
                "repeat_loan_amount": repeat_amount,
                "grand_total_cases": fresh_cases + repeat_cases,
                "grand_total_amount": fresh_amount + repeat_amount,
            }

        branch_agg = (
            loans_qs.annotate(
                effective_branch_id=Coalesce("branch_id", "application__branch_id"),
                effective_branch_name=Coalesce(
                    "branch__branch_name",
                    "application__branch__branch_name",
                ),
            )
            .filter(effective_branch_id__isnull=False)
            .values("effective_branch_id", "effective_branch_name")
            .annotate(achievement=Sum("principal_amount"))
        )
        for row in branch_agg:
            branch_id = str(row["effective_branch_id"])
            branch_achievement[branch_id] = {
                "id": branch_id,
                "branch": row["effective_branch_name"],
                "achievement": _decimal(row["achievement"]),
            }

        officer_targets = OfficerSanctionTarget.objects.select_related("officer")
        branch_targets = BranchSanctionTarget.objects.select_related("branch")

        officer_target_totals: dict[str, Decimal] = {}
        for target in officer_targets:
            if not _month_overlaps_range(target.period_year, target.period_month, start, end):
                continue
            key = str(target.officer_id)
            officer_target_totals[key] = (
                officer_target_totals.get(key, Decimal("0")) + target.target_amount
            )
            if key not in officer_achievement:
                officer_achievement[key] = {
                    "id": key,
                    "officer": _user_label(target.officer),
                    "achievement": Decimal("0"),
                }
            if key not in fresh_repeat:
                fresh_repeat[key] = {
                    "id": key,
                    "officer": _user_label(target.officer),
                    "fresh_cases": 0,
                    "fresh_loan_amount": Decimal("0"),
                    "repeat_cases": 0,
                    "repeat_loan_amount": Decimal("0"),
                    "grand_total_cases": 0,
                    "grand_total_amount": Decimal("0"),
                }

        branch_target_totals: dict[str, Decimal] = {}
        for target in branch_targets:
            if not _month_overlaps_range(target.period_year, target.period_month, start, end):
                continue
            key = str(target.branch_id)
            branch_target_totals[key] = (
                branch_target_totals.get(key, Decimal("0")) + target.target_amount
            )
            if key not in branch_achievement:
                branch_achievement[key] = {
                    "id": key,
                    "branch": target.branch.branch_name,
                    "achievement": Decimal("0"),
                }

        sanctions_rows = []
        for officer_id, row in sorted(
            officer_achievement.items(),
            key=lambda item: item[1]["officer"],
        ):
            target = officer_target_totals.get(officer_id, Decimal("0"))
            achievement = row["achievement"]
            sanctions_rows.append(
                {
                    "id": officer_id,
                    "officer": row["officer"],
                    "target": float(target),
                    "achievement": float(achievement),
                    "percentage": _pct(achievement, target),
                    "deficit": float(_deficit(target, achievement)),
                }
            )

        branch_rows = []
        for branch_id, row in sorted(
            branch_achievement.items(),
            key=lambda item: item[1]["branch"],
        ):
            target = branch_target_totals.get(branch_id, Decimal("0"))
            achievement = row["achievement"]
            branch_rows.append(
                {
                    "id": branch_id,
                    "branch": row["branch"],
                    "target": float(target),
                    "achievement": float(achievement),
                    "percentage": _pct(achievement, target),
                    "deficit": float(_deficit(target, achievement)),
                }
            )

        fresh_repeat_rows = []
        for officer_id, row in sorted(
            fresh_repeat.items(),
            key=lambda item: item[1]["officer"],
        ):
            fresh_repeat_rows.append(
                {
                    "id": officer_id,
                    "officer": row["officer"],
                    "fresh_cases": row["fresh_cases"],
                    "fresh_loan_amount": float(row["fresh_loan_amount"]),
                    "repeat_cases": row["repeat_cases"],
                    "repeat_loan_amount": float(row["repeat_loan_amount"]),
                    "grand_total_cases": row["grand_total_cases"],
                    "grand_total_amount": float(row["grand_total_amount"]),
                }
            )

        return {
            "period_label": period_label,
            "date_from": start.isoformat(),
            "date_to": end.isoformat(),
            "sanctions": sanctions_rows,
            "branches": branch_rows,
            "fresh_repeat": fresh_repeat_rows,
        }
