from decimal import Decimal

from django.utils import timezone

from apps.collections.models import (
    CollectionBucket,
    CollectionCase,
    CollectionCaseStatus,
)
from apps.ledger.services.ledger_posting_service import LedgerPostingService
from apps.loans.models import Loan, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService


class CollectionCaseService:
    @staticmethod
    def _resolve_bucket(*, loan: Loan) -> str:
        application = loan.application
        as_of = timezone.localdate()
        repay_date = (
            LoanCalculationService.resolve_repayment_date(application=application, loan=loan)
            if application
            else None
        )
        if repay_date is None:
            return CollectionBucket.CURRENT
        dpd = max((as_of - repay_date).days, 0)
        if dpd <= 0:
            return CollectionBucket.CURRENT
        if dpd <= 30:
            return CollectionBucket.DAYS_1_30
        if dpd <= 60:
            return CollectionBucket.DAYS_31_60
        if dpd <= 90:
            return CollectionBucket.DAYS_61_90
        return CollectionBucket.DAYS_90_PLUS

    @staticmethod
    def _resolve_dpd(*, loan: Loan) -> int:
        application = loan.application
        as_of = timezone.localdate()
        repay_date = (
            LoanCalculationService.resolve_repayment_date(application=application, loan=loan)
            if application
            else None
        )
        if repay_date is None:
            return 0
        return max((as_of - repay_date).days, 0)

    @staticmethod
    def ensure_case_for_loan(*, loan: Loan, user=None) -> CollectionCase | None:
        if loan.status not in (
            LoanStatus.ACTIVE,
            LoanStatus.OVERDUE,
            LoanStatus.DEFAULTED,
            LoanStatus.CLOSED,
        ):
            return None

        outstanding = LedgerPostingService.get_balance(loan.id)
        bucket = CollectionCaseService._resolve_bucket(loan=loan)
        dpd = CollectionCaseService._resolve_dpd(loan=loan)

        case, created = CollectionCase.objects.get_or_create(
            loan=loan,
            defaults={
                "assigned_collector": user,
                "bucket": bucket,
                "dpd": dpd,
                "outstanding_at_assignment": Decimal(str(outstanding or 0)).quantize(
                    Decimal("0.01")
                ),
                "status": CollectionCaseStatus.OPEN,
                "created_by": user,
                "updated_by": user,
            },
        )
        if not created:
            update_fields = ["bucket", "dpd", "updated_at"]
            case.bucket = bucket
            case.dpd = dpd
            if user and case.assigned_collector_id is None:
                case.assigned_collector = user
                update_fields.append("assigned_collector")
            if loan.status == LoanStatus.CLOSED and case.status == CollectionCaseStatus.OPEN:
                case.status = CollectionCaseStatus.RESOLVED
                case.closed_at = timezone.now()
                update_fields.extend(["status", "closed_at"])
            case.save(update_fields=update_fields)
        return case

    @staticmethod
    def resolve_loan_for_lead(lead) -> Loan | None:
        from apps.loans.models import Loan

        if not lead or not lead.customer_id:
            return None
        return (
            Loan.objects.filter(
                customer_id=lead.customer_id,
                is_deleted=False,
                status__in=(LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED),
            )
            .order_by("-created_at")
            .first()
        )
