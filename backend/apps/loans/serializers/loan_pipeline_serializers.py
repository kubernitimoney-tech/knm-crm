from rest_framework import serializers

from apps.applications.serializers.application_pipeline_serializers import (
    _detail_number,
    _detail_string,
    _latest_decision,
    _user_label,
)
from apps.customers.services.customer_service import CustomerService
from apps.leads.utils.lead_enrichment import resolve_current_employment
from apps.loans.models import LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.loans.services.loan_service import LoanService
from apps.repayments.models import RepaymentStatus


class LoanPipelineRowSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    application_id = serializers.SerializerMethodField()
    lead_id = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source="customer.full_name")
    branch = serializers.SerializerMethodField()
    assigned_cm = serializers.SerializerMethodField()
    email = serializers.CharField(source="customer.email")
    mobile = serializers.CharField(source="customer.mobile_number")
    pancard = serializers.SerializerMethodField()
    loan_amount = serializers.DecimalField(
        source="principal_amount",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    tenure = serializers.SerializerMethodField()
    roi = serializers.SerializerMethodField()
    repay_date = serializers.SerializerMethodField()
    processing_fee = serializers.SerializerMethodField()
    monthly_income = serializers.SerializerMethodField()
    cibil = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    rejection_reason = serializers.SerializerMethodField()
    customer_id = serializers.UUIDField(read_only=True)
    loan_no = serializers.SerializerMethodField()
    loan_type = serializers.SerializerMethodField()
    payment_amount = serializers.SerializerMethodField()
    payment_mode = serializers.SerializerMethodField()
    payment_date = serializers.SerializerMethodField()
    ref_no = serializers.SerializerMethodField()
    discount_amt = serializers.SerializerMethodField()
    settled_amount = serializers.SerializerMethodField()

    def _application(self, obj):
        return getattr(obj, "application", None)

    def get_id(self, obj):
        application = self._application(obj)
        if application and application.lead_id:
            return str(application.lead_id)
        if application:
            return str(application.id)
        return str(obj.id)

    def get_application_id(self, obj):
        application = self._application(obj)
        return application.id if application else obj.id

    def get_lead_id(self, obj):
        application = self._application(obj)
        if application and application.lead_id and application.lead.lead_id:
            return application.lead.lead_id
        return LoanService.display_loan_account_number(obj.loan_account_number)

    def get_branch(self, obj):
        if obj.branch_id:
            return obj.branch.branch_name
        application = self._application(obj)
        if application and application.branch_id:
            return application.branch.branch_name
        decision = _latest_decision(application) if application else None
        if decision:
            return _detail_string(decision.sanction_details or {}, "branch")
        return "—"

    def get_assigned_cm(self, obj):
        application = self._application(obj)
        if not application:
            return "—"
        cm = application.assigned_cm or (
            application.lead.assigned_cm if application.lead_id else None
        )
        label = _user_label(cm)
        return label or "—"

    def get_pancard(self, obj):
        return CustomerService.get_primary_pan(obj.customer) or "—"

    def get_tenure(self, obj):
        application = self._application(obj)
        decision = _latest_decision(application) if application else None
        repayment_date = LoanCalculationService.resolve_repayment_date(
            application=application,
            loan=obj,
            decision=decision,
        )
        return LoanCalculationService.compute_contract_tenure_days(
            repayment_date=repayment_date,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=obj),
            disbursal_sheet_sent_date=LoanCalculationService.resolve_sheet_sent_date(
                application=application
            ),
            sanction_date=LoanCalculationService.resolve_sanction_date(
                application=application,
                decision=decision,
            ),
        )

    def get_roi(self, obj):
        rate = obj.interest_rate
        if rate is not None:
            return f"{float(rate):.2f}"
        return "0.00"

    def get_repay_date(self, obj):
        if obj.due_date:
            return obj.due_date.isoformat()
        application = self._application(obj)
        decision = _latest_decision(application) if application else None
        if decision:
            repay = _detail_string(decision.sanction_details or {}, "repayment_date")
            if repay:
                return repay
        return obj.created_at.isoformat()

    def get_processing_fee(self, obj):
        fee = obj.processing_fee
        return float(fee) if fee is not None else 0

    def get_monthly_income(self, obj):
        application = self._application(obj)
        decision = _latest_decision(application) if application else None
        if decision:
            income = _detail_number(decision.sanction_details or {}, "monthly_income")
            if income:
                return income
        employment = resolve_current_employment(obj.customer)
        if employment and employment.monthly_salary is not None:
            return float(employment.monthly_salary)
        return 0

    def get_cibil(self, obj):
        application = self._application(obj)
        decision = _latest_decision(application) if application else None
        if decision:
            return _detail_number(decision.sanction_details or {}, "cibil_score")
        return 0

    def get_status(self, obj):
        return LoanCalculationService.pipeline_status_label(obj)

    def get_rejection_reason(self, obj):
        return ""

    def _confirmed_repayments(self, obj):
        prefetched = getattr(obj, "_prefetched_objects_cache", {}).get("repayments")
        if prefetched is not None:
            return [item for item in prefetched if item.status == RepaymentStatus.CONFIRMED]
        return list(
            obj.repayments.filter(status=RepaymentStatus.CONFIRMED).order_by("-payment_date")
        )

    def _last_repayment(self, obj):
        repayments = self._confirmed_repayments(obj)
        if not repayments:
            return None
        return max(repayments, key=lambda item: item.payment_date)

    def _settlement(self, obj):
        return getattr(obj, "settlement", None)

    def get_payment_amount(self, obj):
        settlement = self._settlement(obj)
        if settlement and settlement.settlement_amount is not None:
            return float(settlement.settlement_amount)
        repayment = self._last_repayment(obj)
        if repayment:
            return float(repayment.amount)
        return 0

    def get_payment_mode(self, obj):
        repayment = self._last_repayment(obj)
        if repayment:
            return repayment.get_payment_mode_display()
        return "—"

    def get_payment_date(self, obj):
        settlement = self._settlement(obj)
        if settlement and settlement.settled_at:
            return settlement.settled_at.isoformat()
        repayment = self._last_repayment(obj)
        if repayment and repayment.payment_date:
            return repayment.payment_date.isoformat()
        if obj.closed_at:
            return obj.closed_at.isoformat()
        return ""

    def get_ref_no(self, obj):
        repayment = self._last_repayment(obj)
        if repayment:
            return repayment.utr or repayment.gateway_reference or "—"
        return "—"

    def get_discount_amt(self, obj):
        """Write-off / wave-off amount for settlement rows."""
        settlement = self._settlement(obj)
        if settlement and settlement.waiver_amount is not None:
            return float(settlement.waiver_amount)
        return 0

    def get_settled_amount(self, obj):
        settlement = self._settlement(obj)
        if settlement and settlement.settlement_amount is not None:
            return float(settlement.settlement_amount)
        repayments = self._confirmed_repayments(obj)
        if repayments:
            return float(sum(item.amount for item in repayments))
        if obj.total_repayable is not None:
            return float(obj.total_repayable)
        return 0

    def get_date(self, obj):
        settlement = self._settlement(obj)
        if settlement and settlement.settled_at:
            return settlement.settled_at
        if obj.status == LoanStatus.CLOSED and obj.closed_at:
            return obj.closed_at
        if obj.disbursed_at:
            return obj.disbursed_at
        return obj.created_at

    def get_loan_no(self, obj):
        return LoanService.display_loan_account_number(obj.loan_account_number)

    def get_loan_type(self, obj):
        if obj.product_id:
            return obj.product.name
        application = self._application(obj)
        if application and application.product_id:
            return application.product.name
        return "—"
