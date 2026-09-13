"""Domain service for payday loan interest and outstanding calculations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.leads.models import LeadStatus
from apps.loans.models import LoanStatus

PERCENTAGE_DISBURSAL_TYPE = "percentage"
DEFAULT_PERCENTAGE_PENALTY_RATE = Decimal("0.25")


@dataclass(frozen=True)
class LoanSummaryMetrics:
    """Computed loan summary figures (numeric; serialize at the API boundary)."""

    principal_amount: Decimal
    roi_percent: Decimal
    tenure_days: int
    elapsed_days: int
    real_days: int
    penalty_days: int
    daily_interest: Decimal
    real_interest: Decimal
    penalty_interest: Decimal
    paid_amount: Decimal
    amount_due: Decimal
    till_date_amount: Decimal
    repay_amount: Decimal
    is_daily_percentage: bool

    def as_api_dict(self, *, branch: str = "") -> dict[str, str]:
        return {
            "branch": branch,
            "loan_disbursed": str(self.principal_amount),
            "roi": f"{self.roi_percent:.2f}",
            "number_of_days": str(self.tenure_days),
            "real_days": str(self.real_days),
            "penalty_days": str(self.penalty_days),
            "real_interest": str(self.real_interest),
            "penalty_interest": str(self.penalty_interest),
            "paid_amount": str(self.paid_amount),
            "amount_due": str(self.amount_due),
            "till_date_amount": str(self.till_date_amount),
            "repay_amount": str(self.repay_amount),
        }


class LoanCalculationService:
    """
    Reusable loan math for API views, admin, reports, and background jobs.

    Contract tenure (No of Days):
    - repayment_date - disbursal_date when disbursed
    - else repayment_date - disbursal_sheet_sent_date when sheet sent
    - else repayment_date - sanction_date

    Real days / real interest accrue only after actual disbursement.
    Real interest = daily ROI % × principal × real days (not capped at contract tenure).
    Penalty days accrue when today is after repayment_date (tenure exceeded).
    Penalty interest = daily penalty % × principal × penalty days (default 0.25% for percentage loans).
    """

    @staticmethod
    def calendar_days_between(later: date, earlier: date) -> int:
        return max((later - earlier).days, 0)

    @classmethod
    def resolve_disbursal_date(
        cls,
        *,
        loan=None,
        application=None,
        sheet_details: dict | None = None,
    ) -> date | None:
        if loan is not None and loan.disbursed_at:
            return cls.to_date(loan.disbursed_at)
        details = sheet_details
        if details is None and application is not None:
            details = application.disbursal_sheet_details or {}
        if details:
            parsed = cls.parse_iso_date(details.get("disbursal_date"))
            if parsed:
                return parsed
        return None

    @classmethod
    def resolve_actual_disbursal_date(cls, *, loan=None) -> date | None:
        if loan is not None and loan.disbursed_at:
            return cls.to_date(loan.disbursed_at)
        return None

    @classmethod
    def resolve_sheet_sent_date(cls, *, application=None) -> date | None:
        if application is not None and application.disbursal_sheet_sent_at:
            return cls.to_date(application.disbursal_sheet_sent_at)
        return None

    @classmethod
    def resolve_sanction_date(cls, *, application=None, decision=None) -> date | None:
        if decision is not None and decision.decided_at:
            return cls.to_date(decision.decided_at)
        if application is not None and application.decided_at:
            return cls.to_date(application.decided_at)
        return None

    @classmethod
    def resolve_repayment_date(cls, *, application=None, loan=None, decision=None) -> date | None:
        if loan is not None and loan.due_date:
            return loan.due_date
        if decision is None and application is not None:
            decision = (
                application.decisions.filter(decision="approved").order_by("-decided_at").first()
            )
        if decision is not None:
            details = decision.sanction_details or {}
            parsed = cls.parse_iso_date(details.get("repayment_date"))
            if parsed:
                return parsed
        return None

    @classmethod
    def resolve_tenure_anchor_date(
        cls,
        *,
        disbursal_date: date | None = None,
        disbursal_sheet_sent_date: date | None = None,
        sanction_date: date | None = None,
    ) -> date | None:
        if disbursal_date:
            return disbursal_date
        if disbursal_sheet_sent_date:
            return disbursal_sheet_sent_date
        return sanction_date

    @classmethod
    def compute_contract_tenure_days(
        cls,
        *,
        repayment_date: date | None,
        disbursal_date: date | None = None,
        disbursal_sheet_sent_date: date | None = None,
        sanction_date: date | None = None,
    ) -> int:
        anchor = cls.resolve_tenure_anchor_date(
            disbursal_date=disbursal_date,
            disbursal_sheet_sent_date=disbursal_sheet_sent_date,
            sanction_date=sanction_date,
        )
        if anchor and repayment_date:
            return cls.tenure_days(disbursal_date=anchor, due_date=repayment_date)
        return 0

    @classmethod
    def tenure_from_repayment(
        cls,
        *,
        disbursal_date: date | None,
        repayment_date: date | None,
    ) -> int:
        if disbursal_date and repayment_date:
            return cls.tenure_days(disbursal_date=disbursal_date, due_date=repayment_date)
        return 0

    @staticmethod
    def parse_iso_date(value: str | None) -> date | None:
        if value is None:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        if len(raw) >= 10:
            raw = raw[:10]
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None

    @staticmethod
    def to_date(value: date | datetime | None) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        return value

    @classmethod
    def daily_interest(cls, *, principal: Decimal, roi_percent: Decimal) -> Decimal:
        if principal <= 0 or roi_percent <= 0:
            return Decimal("0")
        return (principal * roi_percent) / Decimal("100")

    @classmethod
    def tenure_days(cls, *, disbursal_date: date, due_date: date) -> int:
        return cls.calendar_days_between(due_date, disbursal_date)

    @classmethod
    def elapsed_days(cls, *, disbursal_date: date, as_of: date | None = None) -> int:
        return cls.calendar_days_between(as_of or timezone.localdate(), disbursal_date)

    @classmethod
    def penalty_days(cls, *, repayment_date: date | None, as_of: date | None = None) -> int:
        as_of_date = as_of or timezone.localdate()
        if not repayment_date or as_of_date <= repayment_date:
            return 0
        return cls.calendar_days_between(as_of_date, repayment_date)

    @classmethod
    def penalty_interest_amount(
        cls,
        *,
        principal: Decimal,
        penalty_rate_percent: Decimal,
        penalty_days: int,
    ) -> Decimal:
        if penalty_days <= 0 or principal <= 0 or penalty_rate_percent <= 0:
            return Decimal("0")
        daily_penalty = (principal * penalty_rate_percent) / Decimal("100")
        return (daily_penalty * Decimal(penalty_days)).quantize(Decimal("0.01"))

    @classmethod
    def is_daily_percentage_loan(cls, disbursal_type: str | None) -> bool:
        return str(disbursal_type or "").strip().lower() == PERCENTAGE_DISBURSAL_TYPE

    @classmethod
    def paid_amount_for_loan(cls, loan) -> Decimal:
        if loan is None:
            return Decimal("0")
        return loan.repayments.filter(status="confirmed").aggregate(total=Sum("amount")).get(
            "total"
        ) or Decimal("0")

    @classmethod
    def _positive_penalty_rate(cls, raw) -> Decimal | None:
        if raw in (None, ""):
            return None
        rate = Decimal(str(raw))
        return rate if rate > 0 else None

    @classmethod
    def _resolve_product_for_penalty(cls, *, loan=None, application=None):
        if loan is not None and loan.product_id:
            return loan.product
        if application is not None and application.product_id:
            return application.product
        return None

    @classmethod
    def _uses_default_payday_penalty(cls, *, loan=None, application=None) -> bool:
        product = cls._resolve_product_for_penalty(loan=loan, application=application)
        if product is None:
            return False
        if str(product.product_code or "").strip().upper() == "PAYDAY":
            return True
        return product.tenure_unit == "days" and product.interest_type == "flat"

    @classmethod
    def resolve_penalty_rate_percent(
        cls,
        *,
        loan=None,
        application=None,
        disbursal_type: str | None = None,
    ) -> Decimal:
        if loan is not None:
            snapshot = loan.product_snapshot or {}
            rate = cls._positive_penalty_rate(snapshot.get("penalty_rate"))
            if rate is not None:
                return rate
            if loan.product_id:
                rate = cls._positive_penalty_rate(loan.product.penalty_rate)
                if rate is not None:
                    return rate
        if application is not None:
            app_snapshot = application.product_snapshot or {}
            rate = cls._positive_penalty_rate(app_snapshot.get("penalty_rate"))
            if rate is not None:
                return rate
            if application.product_id:
                rate = cls._positive_penalty_rate(application.product.penalty_rate)
                if rate is not None:
                    return rate
        if cls._uses_default_payday_penalty(loan=loan, application=application):
            return DEFAULT_PERCENTAGE_PENALTY_RATE
        if disbursal_type is None and application is not None:
            disbursal_type = str(
                (application.disbursal_sheet_details or {}).get("disbursal_type") or ""
            )
        if cls.is_daily_percentage_loan(disbursal_type):
            return DEFAULT_PERCENTAGE_PENALTY_RATE
        return Decimal("0")

    @classmethod
    def compute_summary(
        cls,
        *,
        principal_amount: Decimal,
        roi_percent: Decimal,
        penalty_rate_percent: Decimal = Decimal("0"),
        disbursal_type: str | None = None,
        disbursed_at: date | datetime | None = None,
        due_date: date | None = None,
        contract_tenure_days: int | None = None,
        paid_amount: Decimal = Decimal("0"),
        as_of: date | None = None,
    ) -> LoanSummaryMetrics:
        principal_amount = principal_amount or Decimal("0")
        roi_percent = roi_percent or Decimal("0")
        penalty_rate_percent = penalty_rate_percent or Decimal("0")
        paid_amount = paid_amount or Decimal("0")
        as_of_date = as_of or timezone.localdate()

        disbursal_date = cls.to_date(disbursed_at)
        repayment_date = due_date
        tenure_days = contract_tenure_days
        if tenure_days is None and disbursal_date and repayment_date:
            tenure_days = cls.tenure_days(disbursal_date=disbursal_date, due_date=repayment_date)
        tenure_days = tenure_days or 0

        real_days = 0
        if disbursal_date:
            real_days = cls.elapsed_days(disbursal_date=disbursal_date, as_of=as_of_date)

        penalty_days_count = cls.penalty_days(repayment_date=repayment_date, as_of=as_of_date)
        daily_interest = cls.daily_interest(principal=principal_amount, roi_percent=roi_percent)
        real_interest = (daily_interest * Decimal(real_days)).quantize(Decimal("0.01"))
        penalty_interest = cls.penalty_interest_amount(
            principal=principal_amount,
            penalty_rate_percent=penalty_rate_percent,
            penalty_days=penalty_days_count,
        )
        till_date_amount = (
            principal_amount + real_interest + penalty_interest - paid_amount
        ).quantize(Decimal("0.01"))
        amount_due = (principal_amount + real_interest + penalty_interest).quantize(Decimal("0.01"))
        contract_repay_amount = (
            principal_amount + (daily_interest * Decimal(tenure_days))
        ).quantize(Decimal("0.01"))

        if till_date_amount < 0:
            till_date_amount = Decimal("0")

        return LoanSummaryMetrics(
            principal_amount=principal_amount,
            roi_percent=roi_percent,
            tenure_days=tenure_days,
            elapsed_days=real_days,
            real_days=real_days,
            penalty_days=penalty_days_count,
            daily_interest=daily_interest,
            real_interest=real_interest,
            penalty_interest=penalty_interest,
            paid_amount=paid_amount,
            amount_due=amount_due,
            till_date_amount=till_date_amount,
            repay_amount=contract_repay_amount,
            is_daily_percentage=cls.is_daily_percentage_loan(disbursal_type),
        )

    @classmethod
    def compute_for_application(
        cls, application, *, loan=None, as_of: date | None = None
    ) -> LoanSummaryMetrics:
        loan = loan if loan is not None else getattr(application, "loan", None)
        details = dict(application.disbursal_sheet_details or {})
        disbursal_type = str(details.get("disbursal_type") or "")
        decision = application.decisions.filter(decision="approved").order_by("-decided_at").first()

        principal_amount = (
            loan.principal_amount
            if loan
            else (application.approved_amount or application.requested_amount)
        ) or Decimal("0")
        roi_percent = (loan.interest_rate if loan else Decimal("0")) or Decimal("0")
        if not roi_percent and decision and decision.interest_rate is not None:
            roi_percent = decision.interest_rate
        if not roi_percent and application.product_id:
            roi_percent = application.product.interest_rate

        repayment_date = cls.resolve_repayment_date(
            application=application,
            loan=loan,
            decision=decision,
        )
        actual_disbursal_date = cls.resolve_actual_disbursal_date(loan=loan)
        sheet_sent_date = cls.resolve_sheet_sent_date(application=application)
        sanction_date = cls.resolve_sanction_date(application=application, decision=decision)
        contract_tenure = cls.compute_contract_tenure_days(
            repayment_date=repayment_date,
            disbursal_date=actual_disbursal_date,
            disbursal_sheet_sent_date=sheet_sent_date,
            sanction_date=sanction_date,
        )
        penalty_rate_percent = cls.resolve_penalty_rate_percent(
            loan=loan,
            application=application,
            disbursal_type=disbursal_type,
        )
        paid_amount = cls.paid_amount_for_loan(loan)
        disbursed_at = loan.disbursed_at if loan else None

        return cls.compute_summary(
            principal_amount=principal_amount,
            roi_percent=roi_percent,
            penalty_rate_percent=penalty_rate_percent,
            disbursal_type=disbursal_type,
            disbursed_at=disbursed_at,
            due_date=repayment_date,
            contract_tenure_days=contract_tenure,
            paid_amount=paid_amount,
            as_of=as_of,
        )

    @classmethod
    def allowed_collection_status_codes(
        cls,
        *,
        collection_date: date | None,
        repay_date: date | None,
    ) -> frozenset[str]:
        """Statuses permitted for a collection based on collection date vs contractual repay date."""
        if collection_date is None or repay_date is None:
            return frozenset({"part_payment", "close", "payday_pre_close", "settlement"})
        if collection_date < repay_date:
            return frozenset({"part_payment", "payday_pre_close"})
        return frozenset({"close", "settlement", "part_payment"})

    @classmethod
    def resolve_collection_status(
        cls,
        *,
        amount_due: Decimal,
        total_collected: Decimal,
        collection_date: date | None = None,
        disbursal_date: date | None = None,
        repay_date: date | None = None,
    ) -> tuple[str, str]:
        """Return (api_code, display_label) for cumulative collections vs gross amount due."""
        due = (amount_due or Decimal("0")).quantize(Decimal("0.01"))
        collected = (total_collected or Decimal("0")).quantize(Decimal("0.01"))
        if due > 0 and collected >= due:
            if collection_date is not None and repay_date is not None:
                if collection_date < repay_date:
                    return "payday_pre_close", "Payday Pre-Close"
                return "close", "Closed"
            if (
                collection_date is not None
                and disbursal_date is not None
                and collection_date == disbursal_date
            ):
                return "payday_pre_close", "Payday Pre-Close"
            return "close", "Closed"
        if collected > 0:
            return "part_payment", "Part Payment"
        return "part_payment", "Part Payment"

    @classmethod
    def _last_confirmed_repayment(cls, loan):
        from apps.repayments.models import RepaymentStatus

        return (
            loan.repayments.filter(status=RepaymentStatus.CONFIRMED)
            .order_by("-payment_date", "-created_at")
            .first()
        )

    @classmethod
    def collection_status_for_loan(
        cls,
        loan,
        *,
        as_of: date | None = None,
    ) -> tuple[str, str]:
        application = getattr(loan, "application", None)
        if application is None:
            return "part_payment", "Part Payment"

        last_repayment = cls._last_confirmed_repayment(loan)
        if as_of is None and last_repayment is not None:
            as_of = cls.to_date(last_repayment.payment_date)

        metrics = cls.compute_for_application(application, loan=loan, as_of=as_of)
        total_collected = cls.paid_amount_for_loan(loan)
        collection_date = cls.to_date(last_repayment.payment_date) if last_repayment else as_of
        disbursal_date = cls.resolve_actual_disbursal_date(loan=loan)
        repay_date = cls.resolve_repayment_date(application=application, loan=loan)
        return cls.resolve_collection_status(
            amount_due=metrics.amount_due,
            total_collected=total_collected,
            collection_date=collection_date,
            disbursal_date=disbursal_date,
            repay_date=repay_date,
        )

    @classmethod
    def pipeline_status_label(cls, loan) -> str:
        application = getattr(loan, "application", None)
        lead = getattr(application, "lead", None) if application is not None else None
        if lead is not None and lead.status == LeadStatus.SETTLEMENT:
            return "Settlement"
        if getattr(loan, "settlement", None) is not None:
            return "Settlement"
        total_collected = cls.paid_amount_for_loan(loan)
        if loan.status == LoanStatus.CLOSED:
            if total_collected > 0:
                _code, display = cls.collection_status_for_loan(loan)
                return display
            return "Closed"
        if total_collected <= 0:
            return loan.get_status_display()
        _code, display = cls.collection_status_for_loan(loan)
        return display
