"""Record repayments, sync loan/lead status after collection, and post ledger entries."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.applications.models import ApplicationStatus
from apps.applications.services.application_status_service import change_application_status
from apps.collections.services.collection_activity_service import CollectionActivityService
from apps.leads.models import LeadStatus
from apps.leads.services.lead_status_service import change_lead_status
from apps.ledger.models import TransactionType
from apps.ledger.services.ledger_posting_service import LedgerPostingError, LedgerPostingService
from apps.loans.models import Loan, LoanSettlement, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_status_service import change_loan_status
from apps.repayments.models import LoanRepayment, RepaymentStatus


class RepaymentServiceError(Exception):
    pass


COLLECTION_STATUS_OVERRIDE_LABELS = {
    "part_payment": "Part Payment",
    "close": "Closed",
    "payday_pre_close": "Payday Pre-Close",
    "settlement": "Settlement",
}


class RepaymentService:
    @classmethod
    def _validate_collection_status_for_dates(
        cls,
        *,
        collection_status: str | None,
        collection_date,
        application,
        loan: Loan,
    ) -> None:
        if not collection_status:
            return
        as_of = LoanCalculationService.to_date(collection_date)
        repay_date = LoanCalculationService.resolve_repayment_date(
            application=application, loan=loan
        )
        allowed = LoanCalculationService.allowed_collection_status_codes(
            collection_date=as_of,
            repay_date=repay_date,
        )
        if collection_status not in allowed:
            if as_of and repay_date and as_of < repay_date:
                raise RepaymentServiceError(
                    "Before repay date, only Part Payment or Payday Pre-Close status is allowed."
                )
            raise RepaymentServiceError(
                "On or after repay date, only Close, Settlement, or Part Payment status is allowed."
            )

    @classmethod
    def _resolve_sync_status(
        cls,
        *,
        computed_code: str,
        computed_display: str,
        collection_status: str | None = None,
    ) -> tuple[str, str]:
        """Prefer explicit collection form status over amount-derived status when provided."""
        if collection_status in COLLECTION_STATUS_OVERRIDE_LABELS:
            return (
                collection_status,
                COLLECTION_STATUS_OVERRIDE_LABELS[collection_status],
            )
        return computed_code, computed_display

    @classmethod
    def _sync_collection_outcome(
        cls,
        *,
        user,
        loan: Loan,
        application,
        amount_due: Decimal,
        collected_total: Decimal,
        as_of,
        status_code: str,
        status_display: str,
    ) -> dict:
        if status_code in ("close", "payday_pre_close", "settlement"):
            loan.closed_at = timezone.now()
            close_remarks = (
                "Loan pre-closed on disbursal date"
                if status_code == "payday_pre_close"
                else "Loan settled"
                if status_code == "settlement"
                else "Loan fully collected against till date amount"
            )
            if loan.status != LoanStatus.CLOSED:
                change_loan_status(
                    loan=loan,
                    new_status=LoanStatus.CLOSED,
                    user=user,
                    remarks=close_remarks,
                    extra_update_fields=["closed_at"],
                )
            else:
                loan.save(update_fields=["closed_at", "updated_at"])
            if application.status != ApplicationStatus.CLOSED:
                change_application_status(
                    application=application,
                    new_status=ApplicationStatus.CLOSED,
                    user=user,
                    remarks=close_remarks,
                )
            if application.lead_id:
                if status_code == "payday_pre_close":
                    lead_status = LeadStatus.PAYDAY_PRE_CLOSE
                elif status_code == "settlement":
                    lead_status = LeadStatus.SETTLEMENT
                else:
                    lead_status = LeadStatus.CLOSED
                change_lead_status(
                    lead=application.lead,
                    new_status=lead_status,
                    user=user,
                    remarks=close_remarks,
                )
            if status_code == "settlement":
                settled_amount = collected_total.quantize(Decimal("0.01"))
                waiver = max(amount_due - settled_amount, Decimal("0")).quantize(Decimal("0.01"))
                LoanSettlement.objects.update_or_create(
                    loan=loan,
                    defaults={
                        "settlement_amount": settled_amount,
                        "waiver_amount": waiver,
                        "approved_by": user,
                        "settled_at": timezone.now(),
                        "updated_by": user,
                    },
                )
                # Ensure create path stamps created_by once.
                settlement = loan.settlement
                if settlement.created_by_id is None:
                    settlement.created_by = user
                    settlement.save(update_fields=["created_by", "updated_at"])
        elif application.lead_id and collected_total > 0:
            if loan.status == LoanStatus.CLOSED and collected_total < amount_due:
                change_loan_status(
                    loan=loan,
                    new_status=LoanStatus.ACTIVE,
                    user=user,
                    remarks="Loan reopened after collection adjustment",
                    extra_update_fields=["closed_at"],
                )
                loan.closed_at = None
                loan.save(update_fields=["closed_at", "updated_at"])
                if application.status == ApplicationStatus.CLOSED:
                    change_application_status(
                        application=application,
                        new_status=ApplicationStatus.DISBURSED,
                        user=user,
                        remarks="Application reopened after collection adjustment",
                    )
            change_lead_status(
                lead=application.lead,
                new_status=LeadStatus.PART_PAYMENT,
                user=user,
                remarks="Partial collection recorded",
            )
        elif application.lead_id:
            if loan.status == LoanStatus.CLOSED:
                change_loan_status(
                    loan=loan,
                    new_status=LoanStatus.ACTIVE,
                    user=user,
                    remarks="Loan reopened after collection removal",
                    extra_update_fields=["closed_at"],
                )
                loan.closed_at = None
                loan.save(update_fields=["closed_at", "updated_at"])
            if application.status == ApplicationStatus.CLOSED:
                change_application_status(
                    application=application,
                    new_status=ApplicationStatus.DISBURSED,
                    user=user,
                    remarks="Application reopened after collection removal",
                )
            change_lead_status(
                lead=application.lead,
                new_status=LeadStatus.LOAN_RUNNING,
                user=user,
                remarks="All collections removed",
            )

        return {
            "collection_status": status_code,
            "collection_status_display": status_display,
            "amount_due": amount_due,
            "total_collected": collected_total,
            "lead_status": application.lead.status if application.lead_id else "",
            "lead_status_display": (
                application.lead.get_status_display() if application.lead_id else ""
            ),
        }

    @classmethod
    @transaction.atomic
    def record_repayment(
        cls,
        *,
        user,
        loan: Loan,
        amount: Decimal,
        payment_mode: str,
        utr: str = "",
        payment_date=None,
        gateway_reference: str = "",
        remarks: str = "",
        collection_status: str | None = None,
    ) -> dict:
        if loan.status not in (LoanStatus.ACTIVE, LoanStatus.OVERDUE, LoanStatus.DEFAULTED):
            raise RepaymentServiceError("Loan is not in a repayable state.")

        application = loan.application
        if application is None:
            raise RepaymentServiceError("Loan application was not found.")

        payment_date = payment_date or timezone.now()
        as_of = LoanCalculationService.to_date(payment_date) or timezone.localdate()
        collected_before = LoanCalculationService.paid_amount_for_loan(loan)
        metrics_before = LoanCalculationService.compute_for_application(
            application,
            loan=loan,
            as_of=as_of,
        )
        amount_due = metrics_before.amount_due
        collected_after = (collected_before + amount).quantize(Decimal("0.01"))

        if amount_due > 0 and collected_after > amount_due:
            raise RepaymentServiceError("Repayment amount exceeds amount due.")

        balance = LedgerPostingService.get_balance(loan.id)
        if balance <= 0 and amount_due <= collected_before:
            raise RepaymentServiceError("Loan has no outstanding balance.")

        if amount > balance and balance > 0:
            raise RepaymentServiceError("Repayment amount exceeds outstanding balance.")

        cls._validate_collection_status_for_dates(
            collection_status=collection_status,
            collection_date=payment_date,
            application=application,
            loan=loan,
        )

        normalized_utr = str(utr).strip()
        if normalized_utr and LoanRepayment.objects.filter(utr=normalized_utr).exists():
            raise RepaymentServiceError(
                f"UTR '{normalized_utr}' has already been used for another payment. "
                "Please check the UTR/reference number and enter the correct one."
            )

        idempotency_key = f"repay-{loan.id}-{utr}"

        repayment = LoanRepayment.objects.create(
            loan=loan,
            amount=amount,
            payment_mode=payment_mode,
            utr=utr,
            payment_date=payment_date,
            gateway_reference=gateway_reference,
            status=RepaymentStatus.CONFIRMED,
            collected_by=user,
            remarks=remarks,
            created_by=user,
            updated_by=user,
        )

        try:
            entry = LedgerPostingService.post(
                loan=loan,
                transaction_type=TransactionType.REPAYMENT,
                credit_amount=amount,
                reference_type="repayment",
                reference_id=repayment.id,
                narration=f"Repayment via {payment_mode}",
                idempotency_key=idempotency_key,
                user=user,
                transaction_date=payment_date,
            )
        except LedgerPostingError as exc:
            raise RepaymentServiceError(str(exc)) from exc

        repayment.ledger_entry = entry
        repayment.save(update_fields=["ledger_entry", "updated_at"])

        repay_date = LoanCalculationService.resolve_repayment_date(
            application=application, loan=loan
        )
        status_code, status_display = LoanCalculationService.resolve_collection_status(
            amount_due=amount_due,
            total_collected=collected_after,
            collection_date=as_of,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
            repay_date=repay_date,
        )
        status_code, status_display = cls._resolve_sync_status(
            computed_code=status_code,
            computed_display=status_display,
            collection_status=collection_status,
        )

        outcome = cls._sync_collection_outcome(
            user=user,
            loan=loan,
            application=application,
            amount_due=amount_due,
            collected_total=collected_after,
            as_of=as_of,
            status_code=status_code,
            status_display=status_display,
        )

        CollectionActivityService.log_repayment(
            loan=loan,
            user=user,
            amount=amount,
            payment_mode=payment_mode,
            remarks=remarks,
        )

        return {
            "repayment": repayment,
            "till_date_amount": metrics_before.till_date_amount,
            **outcome,
        }

    @classmethod
    @transaction.atomic
    def update_repayment(
        cls,
        *,
        user,
        loan: Loan,
        repayment_id,
        amount: Decimal | None = None,
        payment_mode: str | None = None,
        utr: str | None = None,
        payment_date=None,
        gateway_reference: str | None = None,
        remarks: str | None = None,
        collection_status: str | None = None,
    ) -> dict:
        application = loan.application
        if application is None:
            raise RepaymentServiceError("Loan application was not found.")

        try:
            repayment = LoanRepayment.objects.select_for_update().get(
                id=repayment_id,
                loan=loan,
                status=RepaymentStatus.CONFIRMED,
            )
        except LoanRepayment.DoesNotExist as exc:
            raise RepaymentServiceError("Collection record not found.") from exc

        old_amount = repayment.amount
        new_amount = amount if amount is not None else old_amount
        new_payment_mode = payment_mode if payment_mode is not None else repayment.payment_mode
        new_utr = utr if utr is not None else repayment.utr
        new_payment_date = payment_date if payment_date is not None else repayment.payment_date
        new_gateway_reference = (
            gateway_reference if gateway_reference is not None else repayment.gateway_reference
        )
        new_remarks = remarks if remarks is not None else repayment.remarks

        normalized_utr = str(new_utr).strip()
        if not normalized_utr:
            raise RepaymentServiceError("UTR is required.")

        if LoanRepayment.objects.filter(utr=normalized_utr).exclude(id=repayment.id).exists():
            raise RepaymentServiceError(
                f"UTR '{normalized_utr}' has already been used for another payment. "
                "Please check the UTR/reference number and enter the correct one."
            )

        as_of = LoanCalculationService.to_date(new_payment_date) or timezone.localdate()
        collected_excluding = Decimal("0")
        for item in loan.repayments.filter(status=RepaymentStatus.CONFIRMED).order_by(
            "payment_date", "created_at"
        ):
            if item.id == repayment.id:
                continue
            collected_excluding += item.amount
        collected_after = (collected_excluding + new_amount).quantize(Decimal("0.01"))

        metrics = LoanCalculationService.compute_for_application(
            application,
            loan=loan,
            as_of=as_of,
        )
        amount_due = metrics.amount_due

        if amount_due > 0 and collected_after > amount_due:
            raise RepaymentServiceError("Repayment amount exceeds amount due.")

        cls._validate_collection_status_for_dates(
            collection_status=collection_status,
            collection_date=new_payment_date,
            application=application,
            loan=loan,
        )

        delta = (new_amount - old_amount).quantize(Decimal("0.01"))
        if delta > 0:
            balance = LedgerPostingService.get_balance(loan.id)
            if delta > balance and balance > 0:
                raise RepaymentServiceError("Repayment amount exceeds outstanding balance.")
            try:
                LedgerPostingService.post(
                    loan=loan,
                    transaction_type=TransactionType.REPAYMENT,
                    credit_amount=delta,
                    reference_type="repayment",
                    reference_id=repayment.id,
                    narration=f"Repayment updated via {new_payment_mode}",
                    idempotency_key=f"repay-update-{repayment.id}-{delta}",
                    user=user,
                    transaction_date=new_payment_date,
                )
            except LedgerPostingError as exc:
                raise RepaymentServiceError(str(exc)) from exc
        elif delta < 0:
            try:
                LedgerPostingService.post(
                    loan=loan,
                    transaction_type=TransactionType.REVERSAL,
                    debit_amount=abs(delta),
                    reference_type="repayment",
                    reference_id=repayment.id,
                    narration=f"Repayment amount reduced via {new_payment_mode}",
                    idempotency_key=f"repay-update-{repayment.id}-{delta}",
                    user=user,
                    transaction_date=new_payment_date,
                )
            except LedgerPostingError as exc:
                raise RepaymentServiceError(str(exc)) from exc

        repayment.amount = new_amount
        repayment.payment_mode = new_payment_mode
        repayment.utr = new_utr
        repayment.payment_date = new_payment_date
        repayment.gateway_reference = new_gateway_reference
        repayment.remarks = new_remarks
        repayment.updated_by = user
        repayment.save(
            update_fields=[
                "amount",
                "payment_mode",
                "utr",
                "payment_date",
                "gateway_reference",
                "remarks",
                "updated_by",
                "updated_at",
            ]
        )

        status_code, status_display = LoanCalculationService.resolve_collection_status(
            amount_due=amount_due,
            total_collected=collected_after,
            collection_date=as_of,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
            repay_date=LoanCalculationService.resolve_repayment_date(
                application=application, loan=loan
            ),
        )
        status_code, status_display = cls._resolve_sync_status(
            computed_code=status_code,
            computed_display=status_display,
            collection_status=collection_status,
        )

        outcome = cls._sync_collection_outcome(
            user=user,
            loan=loan,
            application=application,
            amount_due=amount_due,
            collected_total=collected_after,
            as_of=as_of,
            status_code=status_code,
            status_display=status_display,
        )

        CollectionActivityService.log(
            loan=loan,
            user=user,
            outcome="payment_updated",
            notes=f"Collection updated to {new_amount} via {new_payment_mode}",
        )

        return {
            "repayment": repayment,
            "till_date_amount": metrics.till_date_amount,
            **outcome,
        }

    @classmethod
    @transaction.atomic
    def delete_repayment(
        cls,
        *,
        user,
        loan: Loan,
        repayment_id,
    ) -> dict:
        application = loan.application
        if application is None:
            raise RepaymentServiceError("Loan application was not found.")

        try:
            repayment = LoanRepayment.objects.select_for_update().get(
                id=repayment_id,
                loan=loan,
                status=RepaymentStatus.CONFIRMED,
            )
        except LoanRepayment.DoesNotExist as exc:
            raise RepaymentServiceError("Collection record not found.") from exc

        amount = repayment.amount
        payment_date = repayment.payment_date

        try:
            LedgerPostingService.post(
                loan=loan,
                transaction_type=TransactionType.REVERSAL,
                debit_amount=amount,
                reference_type="repayment",
                reference_id=repayment.id,
                narration="Collection deleted",
                idempotency_key=f"repay-delete-{repayment.id}",
                user=user,
                transaction_date=payment_date,
            )
        except LedgerPostingError as exc:
            raise RepaymentServiceError(str(exc)) from exc

        repayment.status = RepaymentStatus.REVERSED
        repayment.updated_by = user
        repayment.save(update_fields=["status", "updated_by", "updated_at"])

        as_of = timezone.localdate()
        collected_total = LoanCalculationService.paid_amount_for_loan(loan)
        metrics = LoanCalculationService.compute_for_application(
            application,
            loan=loan,
            as_of=as_of,
        )
        amount_due = metrics.amount_due

        status_code, status_display = LoanCalculationService.resolve_collection_status(
            amount_due=amount_due,
            total_collected=collected_total,
            collection_date=as_of,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
            repay_date=LoanCalculationService.resolve_repayment_date(
                application=application, loan=loan
            ),
        )

        outcome = cls._sync_collection_outcome(
            user=user,
            loan=loan,
            application=application,
            amount_due=amount_due,
            collected_total=collected_total,
            as_of=as_of,
            status_code=status_code,
            status_display=status_display,
        )

        CollectionActivityService.log(
            loan=loan,
            user=user,
            outcome="payment_deleted",
            notes=f"Collection deleted: {amount}",
        )

        return {
            "repayment_id": str(repayment.id),
            "till_date_amount": metrics.till_date_amount,
            **outcome,
        }
