from django.contrib import admin

from apps.loans.models import (
    Loan,
    LoanDisbursement,
    LoanPenalty,
    LoanSettlement,
    LoanStatus,
    LoanStatusHistory,
    LoanWriteOff,
)
from apps.loans.services.loan_status_service import change_loan_status


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = (
        "loan_account_number",
        "application",
        "application__lead",
        "customer",
        "status",
        "principal_amount",
        "due_date",
    )
    list_filter = ("status", "product")
    search_fields = (
        "loan_account_number",
        "customer__customer_code",
        "application__application_number",
    )

    def save_model(self, request, obj, form, change):
        """Route status changes through the closure service.

        Closing here stops interest and penalty on ``closed_at`` and closes the
        application and lead. Reopening clears ``closed_at`` so accrual resumes.
        """
        if change and "due_date" in form.changed_data:
            self._sync_due_date_to_sanction(request, obj)
        if not change or "status" not in form.changed_data:
            super().save_model(request, obj, form, change)
            return
        from apps.loans.services.loan_closure_service import (
            close_loan_manually,
            reopen_loan_manually,
        )

        new_status = obj.status
        obj.status = Loan.objects.filter(pk=obj.pk).values_list("status", flat=True).first()
        super().save_model(request, obj, form, change)
        if new_status == LoanStatus.CLOSED:
            close_loan_manually(loan=obj, user=request.user)
        elif obj.status == LoanStatus.CLOSED:
            reopen_loan_manually(loan=obj, user=request.user, new_status=new_status)
        else:
            change_loan_status(
                loan=obj, new_status=new_status, user=request.user, remarks="Changed in admin"
            )

    @staticmethod
    def _sync_due_date_to_sanction(request, loan):
        """Keep the sanction's repayment date (shown on Lead Details) in step with the
        loan's due date, and refresh tenure/interest for the new date."""
        application = loan.application
        decision = (
            application.decisions.filter(decision="approved").order_by("-decided_at").first()
            if application
            else None
        )
        if decision is None:
            return
        details = dict(decision.sanction_details or {})
        details["repayment_date"] = loan.due_date.isoformat()
        decision.sanction_details = details
        decision.updated_by = request.user
        decision.save(update_fields=["sanction_details", "updated_by", "updated_at"])
        from apps.loans.services.loan_service import LoanService

        LoanService.sync_with_sanction(user=request.user, loan=loan, decision=decision)


@admin.register(LoanDisbursement)
class LoanDisbursementAdmin(admin.ModelAdmin):
    list_display = (
        "loan",
        "status",
        "disbursed_amount",
        "gross_amount",
        "deductions",
        "payment_mode",
        "utr_reference",
        "disbursed_at",
        "disbursed_by",
        "lender_account",
        "beneficiary_account",
        "ledger_entry",
        "remarks",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    list_filter = ("status", "payment_mode", "disbursed_at")
    search_fields = (
        "utr_reference",
        "loan__loan_account_number",
        "remarks",
        "beneficiary_account__bank_name",
        "beneficiary_account__ifsc_code",
        "lender_account__account_name",
        "lender_account__bank_name",
        "lender_account__ifsc_code",
    )
    list_select_related = (
        "loan",
        "lender_account",
        "beneficiary_account",
        "disbursed_by",
        "ledger_entry",
        "created_by",
        "updated_by",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-disbursed_at",)

    def save_model(self, request, obj, form, change):
        """Mirror UTR edits onto the application's disbursal sheet copy."""
        super().save_model(request, obj, form, change)
        if not change or "utr_reference" not in form.changed_data:
            return
        application = obj.loan.application
        if not application:
            return
        details = dict(application.disbursal_sheet_details or {})
        details["disbursal_reference_no"] = str(obj.utr_reference).strip()
        application.disbursal_sheet_details = details
        application.save(update_fields=["disbursal_sheet_details", "updated_at"])


@admin.register(LoanPenalty)
class LoanPenaltyAdmin(admin.ModelAdmin):
    list_display = ("loan", "penalty_date", "penalty_amount", "reason", "waived")
    list_filter = ("waived", "reason")
    search_fields = ("loan__loan_account_number", "reason")


@admin.register(LoanSettlement)
class LoanSettlementAdmin(admin.ModelAdmin):
    list_display = ("loan", "settlement_amount", "waiver_amount", "approved_by", "settled_at")
    search_fields = ("loan__loan_account_number",)


@admin.register(LoanWriteOff)
class LoanWriteOffAdmin(admin.ModelAdmin):
    list_display = ("loan", "write_off_amount", "approved_by", "written_off_at")
    search_fields = ("loan__loan_account_number", "reason")


@admin.register(LoanStatusHistory)
class LoanStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("loan", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("loan__loan_account_number", "remarks")
