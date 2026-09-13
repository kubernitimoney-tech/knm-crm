"""Scheduled loan repayment and overdue notification dispatch."""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.loans.models import Loan, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.notifications.services.notification_service import NotificationService

REPAYMENT_REMINDER_DAYS = 3
OPEN_LOAN_STATUSES = (LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED)


class LoanNotificationService:
    @classmethod
    def _open_loans_queryset(cls):
        return Loan.objects.filter(
            is_deleted=False,
            status__in=OPEN_LOAN_STATUSES,
            disbursed_at__isnull=False,
            due_date__isnull=False,
        ).select_related(
            "customer",
            "application",
            "application__lead",
            "application__assigned_cm",
            "application__lead__assigned_cm",
        )

    @classmethod
    def _loan_still_collectible(cls, loan) -> bool:
        metrics = LoanCalculationService.compute_for_application(
            loan.application,
            loan=loan,
        )
        paid = LoanCalculationService.paid_amount_for_loan(loan)
        return paid < metrics.amount_due - Decimal("0.01")

    @classmethod
    def send_repayment_reminders(cls) -> int:
        today = timezone.localdate()
        sent = 0
        for loan in cls._open_loans_queryset():
            if not cls._loan_still_collectible(loan):
                continue
            days_until_due = (loan.due_date - today).days
            if days_until_due < 0 or days_until_due > REPAYMENT_REMINDER_DAYS:
                continue
            NotificationService.notify_repayment_reminder(
                loan=loan,
                days_until_due=days_until_due,
            )
            sent += 1
        return sent

    @classmethod
    def send_overdue_notifications(cls) -> int:
        today = timezone.localdate()
        sent = 0
        for loan in cls._open_loans_queryset():
            if loan.due_date >= today:
                continue
            if not cls._loan_still_collectible(loan):
                continue
            overdue_days = LoanCalculationService.penalty_days(
                repayment_date=loan.due_date,
                as_of=today,
            )
            if overdue_days <= 0:
                continue
            NotificationService.notify_loan_overdue(
                loan=loan,
                overdue_days=overdue_days,
            )
            sent += 1
        return sent
