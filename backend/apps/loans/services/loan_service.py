from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.applications.models import ApplicationDecision, ApplicationStatus, LoanApplication
from apps.applications.services.application_status_service import change_application_status
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.applications.services.snapshot_service import build_loan_product_snapshot
from apps.ledger.services.ledger_posting_service import LedgerPostingService
from apps.loans.models import DisbursementStatus, Loan, LoanDisbursement, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_status_service import record_loan_status_created
from apps.products.models import InterestType, ProcessingFeeType


class LoanServiceError(Exception):
    pass


def _resolve_disbursed_at(disbursed_at):
    """Preserve the selected calendar date but use the actual clock time for date-only values."""
    now = timezone.localtime()
    if disbursed_at is None:
        return now
    local = (
        timezone.localtime(disbursed_at)
        if timezone.is_aware(disbursed_at)
        else timezone.make_aware(disbursed_at, timezone.get_current_timezone())
    )
    if local.hour == 0 and local.minute == 0 and local.second == 0:
        return local.replace(
            hour=now.hour,
            minute=now.minute,
            second=now.second,
            microsecond=0,
        )
    return local


class LoanService:
    @staticmethod
    def _next_loan_account_number() -> str:
        last = Loan.all_objects.order_by("-created_at").first()
        seq = 1
        if last and last.loan_account_number:
            digits = "".join(ch for ch in last.loan_account_number if ch.isdigit())
            if digits:
                seq = int(digits) + 1
        return f"LN{seq:08d}"

    @staticmethod
    def _calculate_payday_amounts(
        *,
        product,
        principal: Decimal,
        tenure_days: int,
        decision: ApplicationDecision | None = None,
    ) -> tuple[Decimal, Decimal, Decimal]:
        interest_rate = (
            decision.interest_rate if decision and decision.interest_rate else product.interest_rate
        )
        if decision and decision.processing_fee is not None:
            processing_fee = decision.processing_fee
        elif product.processing_fee_type == ProcessingFeeType.PERCENTAGE:
            processing_fee = product.compute_processing_fee(principal)
        else:
            processing_fee = product.processing_fee

        if product.interest_type in (InterestType.FLAT, InterestType.FIXED):
            interest = (principal * interest_rate / Decimal("100")).quantize(Decimal("0.01"))
        else:
            interest = (
                principal * interest_rate / Decimal("100") * Decimal(tenure_days) / Decimal("365")
            ).quantize(Decimal("0.01"))

        total = principal + processing_fee + interest
        return processing_fee, interest, total

    @staticmethod
    def _repayment_date_from_decision(decision: ApplicationDecision | None):
        if not decision:
            return None
        details = decision.sanction_details or {}
        return LoanCalculationService.parse_iso_date(details.get("repayment_date"))

    @classmethod
    @transaction.atomic
    def create_from_application(cls, *, user, application: LoanApplication) -> Loan:
        if application.status != ApplicationStatus.APPROVED:
            raise LoanServiceError("Application must be approved before creating a loan.")
        if hasattr(application, "loan"):
            raise LoanServiceError("Loan already exists for this application.")

        decision = application.decisions.filter(decision="approved").order_by("-decided_at").first()
        principal = application.approved_amount or application.requested_amount
        repay_date = cls._repayment_date_from_decision(decision)
        if repay_date:
            due_date = repay_date
            tenure_days = LoanCalculationService.tenure_days(
                disbursal_date=timezone.localdate(),
                due_date=repay_date,
            )
        else:
            tenure_days = (
                decision.approved_tenure_value
                if decision and decision.approved_tenure_value
                else application.tenure_value
            )
            due_date = timezone.localdate() + timedelta(days=tenure_days)
        processing_fee, interest, total_repayable = cls._calculate_payday_amounts(
            product=application.product,
            principal=principal,
            tenure_days=tenure_days,
            decision=decision,
        )
        interest_rate = (
            decision.interest_rate
            if decision and decision.interest_rate is not None
            else application.product.interest_rate
        )
        product_snapshot = build_loan_product_snapshot(
            application=application,
            processing_fee=processing_fee,
            interest_rate=interest_rate,
            tenure_days=tenure_days,
            approved_amount=principal,
        )

        loan = Loan.objects.create(
            loan_account_number=cls._next_loan_account_number(),
            application=application,
            customer=application.customer,
            product=application.product,
            branch=application.branch,
            principal_amount=principal,
            interest_amount=interest,
            total_repayable=total_repayable,
            product_snapshot=product_snapshot,
            due_date=due_date,
            status=LoanStatus.ACTIVE,
            created_by=user,
            updated_by=user,
        )

        LedgerPostingService.post_payday_loan_charges(
            loan=loan,
            principal=principal,
            processing_fee=processing_fee,
            interest=interest,
            user=user,
        )
        record_loan_status_created(loan=loan, user=user)
        return loan

    @classmethod
    @transaction.atomic
    def disburse_loan(
        cls,
        *,
        user,
        loan: Loan,
        utr_reference: str,
        disbursed_amount: Decimal | None = None,
        beneficiary_account=None,
        lender_account=None,
        payment_mode: str = "NEFT",
        disbursed_at=None,
        disbursal_type: str = "",
        remarks: str = "",
    ) -> LoanDisbursement:
        if loan.disbursed_at:
            raise LoanServiceError("Loan is already disbursed.")

        application = loan.application
        if application and application.status not in (
            ApplicationStatus.DISBURSAL_SHEET_SENT,
            ApplicationStatus.APPROVED,
        ):
            raise LoanServiceError("Submit the disbursal sheet before completing disbursement.")
        if not utr_reference or not str(utr_reference).strip():
            raise LoanServiceError("Disbursal reference number is required to disburse.")

        if application:
            net = SanctionFeeService.net_disbursal_for_application(application)
            net_amount = Decimal(net["amount_to_be_disbursed"])
        else:
            net_amount = disbursed_amount or loan.principal_amount
        disbursed_at_value = _resolve_disbursed_at(disbursed_at)
        disbursement = LoanDisbursement.objects.create(
            loan=loan,
            lender_account=lender_account,
            beneficiary_account=beneficiary_account,
            disbursed_amount=net_amount,
            gross_amount=loan.principal_amount,
            deductions=loan.principal_amount - net_amount,
            payment_mode=payment_mode,
            utr_reference=utr_reference,
            disbursed_by=user,
            disbursed_at=disbursed_at_value,
            status=DisbursementStatus.COMPLETED,
            remarks=remarks,
            created_by=user,
            updated_by=user,
        )
        loan.disbursed_at = disbursement.disbursed_at
        disbursal_date = LoanCalculationService.to_date(loan.disbursed_at)
        if disbursal_date and loan.due_date:
            tenure_days = LoanCalculationService.tenure_days(
                disbursal_date=disbursal_date,
                due_date=loan.due_date,
            )
            snapshot = dict(loan.product_snapshot or {})
            snapshot["tenure_days"] = tenure_days
            loan.product_snapshot = snapshot
            decision = (
                application.decisions.filter(decision="approved").order_by("-decided_at").first()
                if application
                else None
            )
            if decision and decision.approved_tenure_value != tenure_days:
                decision.approved_tenure_value = tenure_days
                decision.save(update_fields=["approved_tenure_value", "updated_at"])
        loan.updated_by = user
        loan.save(update_fields=["disbursed_at", "product_snapshot", "updated_by", "updated_at"])

        if application:
            from apps.leads.services.lead_application_sync import sync_application_lead_link

            sync_application_lead_link(application)
            details = dict(application.disbursal_sheet_details or {})
            details["disbursal_reference_no"] = str(utr_reference).strip()
            details["disbursed_date"] = timezone.localdate().isoformat()
            if disbursal_type:
                details["disbursal_type"] = disbursal_type
            if payment_mode:
                details["payment_type"] = payment_mode
            application.disbursal_sheet_details = details
            change_application_status(
                application=application,
                new_status=ApplicationStatus.DISBURSED,
                user=user,
                remarks=remarks or "Loan disbursed",
                extra_update_fields=["disbursal_sheet_details"],
            )

        return disbursement

    @classmethod
    @transaction.atomic
    def update_disbursement(
        cls,
        *,
        user,
        loan: Loan,
        utr_reference: str | None = None,
        disbursed_amount: Decimal | None = None,
        payment_mode: str | None = None,
        remarks: str | None = None,
    ) -> LoanDisbursement:
        if not loan.disbursed_at:
            raise LoanServiceError("Loan has not been disbursed yet.")
        disbursement = loan.disbursements.order_by("-disbursed_at").first()
        if not disbursement:
            raise LoanServiceError("No disbursement record found.")

        if utr_reference is not None:
            disbursement.utr_reference = utr_reference
            application = loan.application
            if application:
                details = dict(application.disbursal_sheet_details or {})
                details["disbursal_reference_no"] = str(utr_reference).strip()
                application.disbursal_sheet_details = details
                application.save(update_fields=["disbursal_sheet_details", "updated_at"])
        if disbursed_amount is not None:
            disbursement.disbursed_amount = disbursed_amount
            disbursement.deductions = loan.principal_amount - disbursed_amount
        if payment_mode is not None:
            disbursement.payment_mode = payment_mode
        if remarks is not None:
            disbursement.remarks = remarks
        disbursement.updated_by = user
        disbursement.save()
        loan.updated_by = user
        loan.save(update_fields=["updated_by", "updated_at"])
        return disbursement
