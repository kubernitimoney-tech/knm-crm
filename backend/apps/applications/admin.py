from django import forms
from django.contrib import admin

from apps.applications.models import (
    ApplicationDecision,
    ApplicationStatusHistory,
    ApplicationVerification,
    LoanApplication,
    SanctionSalaryBank,
)
from apps.core.admin_mixins import LeadFirstSearchMixin
from apps.loans.services.loan_calculation_service import LoanCalculationService


class ApplicationDecisionAdminForm(forms.ModelForm):
    """Expose the repayment date stored inside ``sanction_details`` as a date field."""

    repayment_date = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={"type": "date"}),
        help_text="Sanctioned repayment date. Saving updates the loan's due date.",
    )

    class Meta:
        model = ApplicationDecision
        fields = (
            "application",
            "decision",
            "decided_by",
            "approved_amount",
            "approved_tenure_value",
            "interest_rate",
            "processing_fee",
            "repayment_date",
            "rejection_reason",
            "remarks",
            "created_by",
            "updated_by",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        details = self.instance.sanction_details or {}
        self.fields["repayment_date"].initial = LoanCalculationService.parse_iso_date(
            details.get("repayment_date")
        )


@admin.register(LoanApplication)
class LoanApplicationAdmin(LeadFirstSearchMixin, admin.ModelAdmin):
    list_display = (
        "lead",
        "application_number",
        "customer",
        "product",
        "status",
        "requested_amount",
    )
    list_filter = ("status", "product")
    search_fields = ("lead__lead_id", "application_number", "customer__customer_code")
    list_select_related = ("lead", "customer", "product")


@admin.register(ApplicationVerification)
class ApplicationVerificationAdmin(admin.ModelAdmin):
    list_display = ("application", "verification_type", "status", "verified_by", "verified_at")
    list_filter = ("verification_type", "status")
    search_fields = ("application__application_number", "notes")


@admin.register(ApplicationDecision)
class ApplicationDecisionAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "decision",
        "approved_amount",
        "approved_tenure_value",
        "interest_rate",
        "processing_fee",
        "decided_by",
        "decided_at",
        "rejection_reason",
        "remarks",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    list_filter = ("decision", "decided_at")
    search_fields = (
        "application__application_number",
        "application__lead__lead_id",
        "rejection_reason",
        "remarks",
    )
    list_select_related = (
        "application",
        "application__lead",
        "decided_by",
        "created_by",
        "updated_by",
    )
    form = ApplicationDecisionAdminForm
    readonly_fields = ("id", "decided_at", "created_at", "updated_at")
    ordering = ("-decided_at",)

    def save_model(self, request, obj, form, change):
        """Write the repayment date back into sanction_details and, when this is the
        current sanction, push the edited terms onto the application and loan."""
        if "repayment_date" in form.changed_data:
            details = dict(obj.sanction_details or {})
            repayment_date = form.cleaned_data.get("repayment_date")
            if repayment_date:
                details["repayment_date"] = repayment_date.isoformat()
            else:
                details.pop("repayment_date", None)
            obj.sanction_details = details
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

        if not change or obj.decision != "approved":
            return
        application = obj.application
        latest = application.decisions.filter(decision="approved").order_by("-decided_at").first()
        if latest is None or latest.pk != obj.pk:
            return
        if obj.approved_amount is not None and application.approved_amount != obj.approved_amount:
            application.approved_amount = obj.approved_amount
            application.updated_by = request.user
            application.save(update_fields=["approved_amount", "updated_by", "updated_at"])

        from apps.loans.models import Loan
        from apps.loans.services.loan_service import LoanService

        loan = Loan.objects.filter(application=application).first()
        if loan is not None:
            LoanService.sync_with_sanction(user=request.user, loan=loan, decision=obj)


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("application", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("application__application_number", "remarks")


@admin.register(SanctionSalaryBank)
class SanctionSalaryBankAdmin(admin.ModelAdmin):
    list_display = ("decision", "bank", "account_number", "created_at")
    search_fields = ("account_number", "bank__name")
