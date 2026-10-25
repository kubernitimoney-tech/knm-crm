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
