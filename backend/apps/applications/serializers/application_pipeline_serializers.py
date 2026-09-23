from rest_framework import serializers

from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import ApplicationService
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.customers.services.customer_service import CustomerService
from apps.leads.utils.lead_enrichment import resolve_beneficiary_disbursal_defaults
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_service import LoanService


def _user_label(user) -> str:
    if not user:
        return ""
    full = user.get_full_name() if hasattr(user, "get_full_name") else ""
    return full.strip() or user.email


def _latest_decision(application):
    prefetched = getattr(application, "_prefetched_objects_cache", {}).get("decisions")
    if prefetched:
        return max(prefetched, key=lambda item: item.decided_at)
    return application.decisions.order_by("-decided_at").first()


def _detail_string(details: dict, key: str) -> str:
    value = details.get(key)
    if value is None or value == "":
        return ""
    return str(value)


def _detail_number(details: dict, key: str) -> float:
    try:
        return float(details.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


def _resolve_enach_status(application) -> str:
    sheet = dict(application.disbursal_sheet_details or {})
    if _detail_string(sheet, "enach_id"):
        return "Registered"
    return "Pending"


class ApplicationPipelineRowSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    application_id = serializers.UUIDField(source="id")
    lead_id = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source="customer.full_name")
    branch = serializers.SerializerMethodField()
    assigned_cm = serializers.SerializerMethodField()
    email = serializers.CharField(source="customer.email")
    mobile = serializers.CharField(source="customer.mobile_number")
    pancard = serializers.SerializerMethodField()
    loan_amount = serializers.SerializerMethodField()
    tenure = serializers.SerializerMethodField()
    roi = serializers.SerializerMethodField()
    repay_date = serializers.SerializerMethodField()
    processing_fee = serializers.SerializerMethodField()
    monthly_income = serializers.SerializerMethodField()
    cibil = serializers.SerializerMethodField()
    status = serializers.CharField(source="get_status_display", read_only=True)
    date = serializers.SerializerMethodField()
    rejection_reason = serializers.SerializerMethodField()
    customer_id = serializers.UUIDField(read_only=True)
    account_no = serializers.SerializerMethodField()
    ifsc_code = serializers.SerializerMethodField()
    loan_no = serializers.SerializerMethodField()
    loan_account = serializers.SerializerMethodField()
    disbursed_amount = serializers.SerializerMethodField()
    bank_name = serializers.SerializerMethodField()
    enach_status = serializers.SerializerMethodField()

    def get_id(self, obj):
        """Return lead UUID for frontend lead-detail routes (never application UUID)."""
        if obj.lead_id:
            return str(obj.lead_id)
        from apps.leads.models import Lead

        lead_pk = (
            Lead.objects.filter(converted_application_id=obj.pk, is_deleted=False)
            .values_list("id", flat=True)
            .first()
        )
        if lead_pk:
            return str(lead_pk)
        # Last resort: callers still need a stable row key; detail navigation may 404.
        return str(obj.id)

    def get_lead_id(self, obj):
        if obj.lead_id and obj.lead.lead_id:
            return obj.lead.lead_id
        from apps.leads.models import Lead

        code = (
            Lead.objects.filter(converted_application_id=obj.pk, is_deleted=False)
            .values_list("lead_id", flat=True)
            .first()
        )
        if code:
            return code
        return ApplicationService.display_application_number(obj.application_number)

    def get_branch(self, obj):
        if obj.branch_id:
            return obj.branch.branch_name
        decision = _latest_decision(obj)
        if decision:
            return _detail_string(decision.sanction_details or {}, "branch")
        return "—"

    def get_assigned_cm(self, obj):
        cm = obj.assigned_cm or (obj.lead.assigned_cm if obj.lead_id else None)
        label = _user_label(cm)
        return label or "—"

    def get_pancard(self, obj):
        return CustomerService.get_primary_pan(obj.customer) or "—"

    def get_loan_amount(self, obj):
        decision = _latest_decision(obj)
        if decision and decision.approved_amount is not None:
            return decision.approved_amount
        if obj.approved_amount is not None:
            return obj.approved_amount
        return obj.requested_amount

    def get_tenure(self, obj):
        decision = _latest_decision(obj)
        loan = getattr(obj, "loan", None)
        repayment_date = LoanCalculationService.resolve_repayment_date(
            application=obj,
            loan=loan,
            decision=decision,
        )
        return LoanCalculationService.compute_contract_tenure_days(
            repayment_date=repayment_date,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
            disbursal_sheet_sent_date=LoanCalculationService.resolve_sheet_sent_date(
                application=obj
            ),
            sanction_date=LoanCalculationService.resolve_sanction_date(
                application=obj,
                decision=decision,
            ),
        )

    def get_roi(self, obj):
        decision = _latest_decision(obj)
        if decision and decision.interest_rate is not None:
            return f"{decision.interest_rate:.2f}"
        return "0.00"

    def get_repay_date(self, obj):
        decision = _latest_decision(obj)
        if decision:
            repay = _detail_string(decision.sanction_details or {}, "repayment_date")
            if repay:
                return repay
        if obj.decided_at:
            return obj.decided_at.isoformat()
        if obj.submitted_at:
            return obj.submitted_at.isoformat()
        return obj.created_at.isoformat()

    def get_processing_fee(self, obj):
        decision = _latest_decision(obj)
        if decision and decision.processing_fee is not None:
            return decision.processing_fee
        return 0

    def get_monthly_income(self, obj):
        decision = _latest_decision(obj)
        if decision:
            income = _detail_number(decision.sanction_details or {}, "monthly_income")
            if income:
                return income
        from apps.leads.utils.lead_enrichment import resolve_current_employment

        employment = resolve_current_employment(obj.customer)
        if employment and employment.monthly_salary is not None:
            return employment.monthly_salary
        return 0

    def get_cibil(self, obj):
        decision = _latest_decision(obj)
        if decision:
            return _detail_number(decision.sanction_details or {}, "cibil_score")
        return 0

    def get_rejection_reason(self, obj):
        decision = _latest_decision(obj)
        if decision and decision.decision == "rejected":
            return decision.rejection_reason
        return ""

    def get_date(self, obj):
        if obj.status == ApplicationStatus.DISBURSAL_SHEET_SENT and obj.disbursal_sheet_sent_at:
            return obj.disbursal_sheet_sent_at
        loan = getattr(obj, "loan", None)
        if obj.status == ApplicationStatus.DISBURSED and loan and loan.disbursed_at:
            return loan.disbursed_at
        return obj.created_at

    def _sheet_details(self, obj) -> dict:
        return dict(obj.disbursal_sheet_details or {})

    def get_account_no(self, obj):
        details = self._sheet_details(obj)
        account = _detail_string(details, "account_number")
        if account:
            return account
        return resolve_beneficiary_disbursal_defaults(obj).get("account_number") or ""

    def get_ifsc_code(self, obj):
        details = self._sheet_details(obj)
        code = _detail_string(details, "ifsc_code")
        if code:
            return code
        return resolve_beneficiary_disbursal_defaults(obj).get("ifsc_code") or ""

    def get_loan_no(self, obj):
        loan = getattr(obj, "loan", None)
        if loan:
            return LoanService.display_loan_account_number(loan.loan_account_number)
        return ApplicationService.display_application_number(obj.application_number)

    def get_loan_account(self, obj):
        loan = getattr(obj, "loan", None)
        return LoanService.display_loan_account_number(loan.loan_account_number) if loan else ""

    def get_disbursed_amount(self, obj):
        details = self._sheet_details(obj)
        amount = _detail_number(details, "amount_to_be_disbursed")
        if amount:
            return amount

        loan = getattr(obj, "loan", None)
        if loan:
            disbursement = loan.disbursements.order_by("-disbursed_at").first()
            if disbursement and disbursement.disbursed_amount is not None:
                return float(disbursement.disbursed_amount)

        net = SanctionFeeService.net_disbursal_for_application(obj)
        return float(net["amount_to_be_disbursed"])

    def get_bank_name(self, obj):
        details = self._sheet_details(obj)
        name = _detail_string(details, "bank_name")
        if name:
            return name
        return resolve_beneficiary_disbursal_defaults(obj).get("bank_name") or ""

    def get_enach_status(self, obj):
        return _resolve_enach_status(obj)
