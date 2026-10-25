"""Manual loan close / reopen by the business (Django admin)."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.loans.models import Loan, LoanStatus
from apps.loans.services.loan_status_service import change_loan_status


@transaction.atomic
def close_loan_manually(*, loan: Loan, user, remarks: str = "") -> Loan:
    """Close a loan without a collection (rare cash case).

    Interest and penalty stop accruing on ``closed_at``. A close date already
    entered on the form is kept; otherwise the loan closes now.
    """
    from apps.applications.models import ApplicationStatus
    from apps.applications.services.application_status_service import (
        change_application_status,
    )
    from apps.leads.models import LeadStatus
    from apps.leads.services.lead_status_service import change_lead_status

    remarks = remarks or "Loan closed manually by business"
    loan.closed_at = loan.closed_at or timezone.now()
    if loan.status != LoanStatus.CLOSED:
        change_loan_status(
            loan=loan,
            new_status=LoanStatus.CLOSED,
            user=user,
            remarks=remarks,
            extra_update_fields=["closed_at"],
        )
    else:
        loan.save(update_fields=["closed_at", "updated_at"])

    application = loan.application
    if application is not None:
        if application.status != ApplicationStatus.CLOSED:
            change_application_status(
                application=application,
                new_status=ApplicationStatus.CLOSED,
                user=user,
                remarks=remarks,
            )
        if application.lead_id:
            change_lead_status(
                lead=application.lead,
                new_status=LeadStatus.CLOSED,
                user=user,
                remarks=remarks,
            )
    return loan


@transaction.atomic
def reopen_loan_manually(*, loan: Loan, user, new_status: str, remarks: str = "") -> Loan:
    """Undo a close: interest and penalty run again from the original dates."""
    from apps.applications.models import ApplicationStatus
    from apps.applications.services.application_status_service import (
        change_application_status,
    )
    from apps.leads.models import LeadStatus
    from apps.leads.services.lead_status_service import change_lead_status
    from apps.loans.models import LoanSettlement
    from apps.loans.services.loan_calculation_service import LoanCalculationService

    remarks = remarks or "Loan reopened manually by business"
    loan.closed_at = None
    change_loan_status(
        loan=loan,
        new_status=new_status,
        user=user,
        remarks=remarks,
        extra_update_fields=["closed_at"],
    )
    loan.save(update_fields=["closed_at", "updated_at"])
    LoanSettlement.objects.filter(loan=loan).delete()

    application = loan.application
    if application is not None:
        if application.status == ApplicationStatus.CLOSED:
            change_application_status(
                application=application,
                new_status=ApplicationStatus.DISBURSED,
                user=user,
                remarks=remarks,
            )
        if application.lead_id:
            paid = LoanCalculationService.paid_amount_for_loan(loan)
            change_lead_status(
                lead=application.lead,
                new_status=LeadStatus.PART_PAYMENT if paid > 0 else LeadStatus.LOAN_RUNNING,
                user=user,
                remarks=remarks,
            )
    return loan
