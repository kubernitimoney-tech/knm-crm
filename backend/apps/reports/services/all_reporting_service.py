"""All Reporting — disbursed, collection, and CIBIL tabular data.

Row builders assume queryset prefetch/annotation from _visible_loans_queryset and
_visible_repayments_queryset to keep list APIs to O(page_size) queries.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Sum

from apps.accounts.services.role_helpers import (
    is_account_finance,
    is_admin_user,
    is_super_admin,
)
from apps.applications.models import ApplicationStatus
from apps.applications.serializers.application_pipeline_serializers import (
    _detail_number,
    _detail_string,
    _user_label,
)
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.customers.models import CustomerStatus
from apps.customers.services.customer_service import CustomerService
from apps.leads.models import Lead, LeadCategory
from apps.leads.utils.lead_enrichment import (
    resolve_beneficiary_disbursal_defaults,
    resolve_company_disbursal_account,
    resolve_current_employment,
    resolve_customer_address,
)
from apps.loans.models import Loan, LoanDisbursement, LoanStatus
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.repayments.models import LoanRepayment, RepaymentStatus


def _str(value) -> str:
    if value is None:
        return ""
    return str(value)


def _money(value) -> str:
    if value is None:
        return "0"
    try:
        return f"{Decimal(str(value)):.2f}"
    except Exception:
        return "0"


def _approved_decision(application):
    """Latest approved sanction decision; reads Prefetch(to_attr='_report_decisions') when present."""
    if application is None:
        return None
    prefetched = getattr(application, "_report_decisions", None)
    if prefetched is None:
        prefetched = getattr(application, "_prefetched_objects_cache", {}).get("decisions")
    if prefetched:
        approved = [item for item in prefetched if item.decision == "approved"]
        if approved:
            return max(approved, key=lambda item: item.decided_at)
    return application.decisions.filter(decision="approved").order_by("-decided_at").first()


def _latest_disbursement(loan):
    """Most recent disbursement from prefetch (ordered -disbursed_at) or DB."""
    prefetched = getattr(loan, "_prefetched_objects_cache", {}).get("disbursements")
    if prefetched:
        return prefetched[0] if prefetched else None
    return loan.disbursements.order_by("-disbursed_at").first()


def _paid_total_for_loan(loan) -> Decimal:
    """Confirmed repayment total from queryset annotation or per-loan aggregate."""
    annotated = getattr(loan, "_total_paid", None)
    if annotated is not None:
        return Decimal(str(annotated or "0")).quantize(Decimal("0.01"))
    return LoanCalculationService.paid_amount_for_loan(loan)


def _can_view_all_reporting_records(user) -> bool:
    return is_super_admin(user) or is_admin_user(user) or is_account_finance(user)


def _customer_lead_count_subquery():
    """Non-deleted leads per customer — used for reloan badge count on reporting rows."""
    return Subquery(
        Lead.objects.filter(customer_id=OuterRef("customer_id"), is_deleted=False)
        .values("customer_id")
        .annotate(_cnt=Count("id"))
        .values("_cnt")[:1],
        output_field=IntegerField(),
    )


def _customer_lead_count(loan) -> int:
    annotated = getattr(loan, "_customer_lead_count", None)
    if annotated is not None:
        return int(annotated)
    if not loan.customer_id:
        return 0
    return loan.customer.leads.filter(is_deleted=False).count()


def _visible_loans_queryset(user):
    qs = (
        Loan.objects.filter(is_deleted=False, disbursed_at__isnull=False)
        .select_related(
            "customer",
            "product",
            "branch",
            "application",
            "application__branch",
            "application__lead",
            "application__lead__source",
            "application__assigned_cm",
            "application__assigned_rm",
            "application__lead__assigned_cm",
            "application__lead__assigned_rm",
        )
        .prefetch_related(
            Prefetch(
                "application__decisions",
                to_attr="_report_decisions",
            ),
            "customer__identities",
            "customer__employments",
            "customer__addresses",
            "customer__bank_accounts",
            Prefetch(
                "disbursements",
                queryset=LoanDisbursement.objects.select_related("lender_account").order_by(
                    "-disbursed_at"
                ),
            ),
            "penalties",
            "settlement",
        )
        .annotate(
            _total_paid=Sum(
                "repayments__amount",
                filter=Q(repayments__status=RepaymentStatus.CONFIRMED),
            ),
            _customer_lead_count=_customer_lead_count_subquery(),
        )
        .order_by("-disbursed_at")
    )
    if _can_view_all_reporting_records(user):
        return qs
    return [loan for loan in qs if loan.check_user_access(user)]


def _visible_repayments_queryset(user):
    qs = (
        LoanRepayment.objects.filter(status=RepaymentStatus.CONFIRMED)
        .select_related(
            "loan",
            "loan__customer",
            "loan__branch",
            "loan__application",
            "loan__application__lead",
            "loan__application__branch",
            "collected_by",
        )
        .prefetch_related(
            "loan__application__decisions",
            "loan__penalties",
            "loan__settlement",
            "loan__customer__identities",
        )
        .order_by("-payment_date")
    )
    if _can_view_all_reporting_records(user):
        return qs
    return [repayment for repayment in qs if repayment.loan.check_user_access(user)]


def _lead_row_id(application) -> str:
    if application and application.lead_id:
        return str(application.lead_id)
    if application:
        return str(application.id)
    return ""


def _lead_display_id(application, loan) -> str:
    if application and application.lead_id and application.lead.lead_id:
        return application.lead.lead_id
    if application:
        return application.application_number
    return loan.loan_account_number


def _branch_name(loan, application, decision) -> str:
    if loan.branch_id:
        return loan.branch.branch_name
    if application and application.branch_id:
        return application.branch.branch_name
    if decision:
        return _detail_string(decision.sanction_details or {}, "branch")
    return "—"


def _sheet_details(application) -> dict:
    if not application:
        return {}
    return dict(application.disbursal_sheet_details or {})


def _tenure_days(loan, application, decision) -> int:
    repayment_date = LoanCalculationService.resolve_repayment_date(
        application=application,
        loan=loan,
        decision=decision,
    )
    return LoanCalculationService.compute_contract_tenure_days(
        repayment_date=repayment_date,
        disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
        disbursal_sheet_sent_date=LoanCalculationService.resolve_sheet_sent_date(
            application=application
        ),
        sanction_date=LoanCalculationService.resolve_sanction_date(
            application=application,
            decision=decision,
        ),
    )


def _build_disbursed_row(loan: Loan) -> dict:
    application = loan.application
    lead = application.lead if application and application.lead_id else None
    decision = _approved_decision(application)
    details = decision.sanction_details or {} if decision else {}
    sheet = _sheet_details(application)
    employment = resolve_current_employment(loan.customer)
    address = resolve_customer_address(loan.customer)
    bank_defaults = resolve_beneficiary_disbursal_defaults(application) if application else {}
    disbursement = _latest_disbursement(loan)
    company_account = resolve_company_disbursal_account(
        branch=application.branch if application else None
    )

    account_no = (
        _detail_string(sheet, "account_number") or bank_defaults.get("account_number") or ""
    )
    bank_ifsc = _detail_string(sheet, "ifsc_code") or bank_defaults.get("ifsc_code") or ""
    bank_name = _detail_string(sheet, "bank_name") or bank_defaults.get("bank_name") or ""

    net = SanctionFeeService.net_disbursal_for_application(application) if application else {}
    processing_fee = loan.processing_fee
    tax = _detail_number(details, "gst") if details else Decimal("0")
    if not tax and net:
        try:
            tax = Decimal(str(net.get("gst") or "0"))
        except Exception:
            tax = Decimal("0")

    monthly_income = _detail_number(details, "monthly_income") if details else 0
    if not monthly_income and employment and employment.monthly_salary is not None:
        monthly_income = float(employment.monthly_salary)

    monthly_obligation = _detail_number(details, "monthly_obligation") if details else 0

    cibil = _detail_number(details, "cibil_score") if details else 0

    red_flag = "No"
    if lead and lead.status == "not_interested":
        red_flag = "Yes"
    elif loan.customer.status == CustomerStatus.BLACKLISTED:
        red_flag = "Yes"

    fi_done_by = _detail_string(sheet, "fi_done_by")
    pd_by = fi_done_by or _user_label(application.assigned_rm if application else None)
    cred_by = _user_label(
        decision.decided_by if decision else (application.assigned_cm if application else None)
    )

    beneficiary_branch = _detail_string(sheet, "branch") or bank_defaults.get("branch") or ""
    company_account_number = _detail_string(sheet, "company_account")
    if not company_account_number and company_account:
        company_account_number = company_account.account_number

    status = loan.get_status_display()
    if application and application.status == ApplicationStatus.DISBURSED:
        status = application.get_status_display()
    if loan.status in (
        LoanStatus.ACTIVE,
        LoanStatus.OVERDUE,
        LoanStatus.DEFAULTED,
        LoanStatus.CLOSED,
    ):
        if _paid_total_for_loan(loan) > 0 or loan.status == LoanStatus.CLOSED:
            status = LoanCalculationService.pipeline_status_label(loan)

    return {
        "id": _lead_row_id(application),
        "customerId": str(loan.customer_id),
        "leadId": _lead_display_id(application, loan),
        "loanNo": loan.loan_account_number,
        "name": loan.customer.full_name,
        "dob": loan.customer.dob.isoformat() if loan.customer.dob else "",
        "gender": loan.customer.get_gender_display() if loan.customer.gender else "—",
        "pan": CustomerService.get_primary_pan(loan.customer) or "—",
        "adharCard": CustomerService.get_primary_aadhaar(loan.customer) or "—",
        "mob": loan.customer.mobile_number or "—",
        "email": loan.customer.email or "—",
        "branch": _branch_name(loan, application, decision),
        "credBy": cred_by,
        "pdBy": pd_by or "—",
        "employed": employment.get_employment_type_display() if employment else "—",
        "monthlyIncome": _money(monthly_income),
        "monthlyObligation": _money(monthly_obligation),
        "loanAmt": _money(loan.principal_amount),
        "tenure": str(_tenure_days(loan, application, decision)),
        "roi": _money(loan.interest_rate),
        "repayDate": loan.due_date.isoformat() if loan.due_date else "",
        "disbursalDate": loan.disbursed_at.date().isoformat() if loan.disbursed_at else "",
        "recidanceType": address.get_address_type_display() if address else "—",
        "accountNo": account_no,
        "bankIfsc": bank_ifsc,
        "bankName": bank_name,
        "accountType": _detail_string(sheet, "account_type") or "Savings",
        "beneficiaryBranch": beneficiary_branch,
        "checkNo": _detail_string(sheet, "cheque_no"),
        "enachDetails": _detail_string(sheet, "enach_id"),
        "disbursalRefNo": _detail_string(sheet, "disbursal_reference_no")
        or (disbursement.utr_reference if disbursement else ""),
        "companyAccount": company_account_number or "",
        "processingFee": _money(processing_fee),
        "tax": _money(tax),
        "cibil": _str(int(cibil)) if cibil else "0",
        "utm": lead.source.name if lead and lead.source_id else "—",
        "state": address.state if address else "—",
        "redFlag": red_flag,
        "leadCategory": lead.get_category_display() if lead else LeadCategory.FRESH.label,
        "customerLeadCount": _customer_lead_count(loan),
        "status": status,
        "leadComingDate": lead.created_at.isoformat()
        if lead
        else (application.created_at.isoformat() if application else ""),
    }


def _build_collection_row(repayment: LoanRepayment) -> dict:
    from apps.repayments.services.collection_status_service import collection_status_for_repayment

    loan = repayment.loan
    application = loan.application
    address = resolve_customer_address(loan.customer)
    settlement = getattr(loan, "settlement", None)
    penal_total = loan.penalties.filter(waived=False).aggregate(total=Sum("penalty_amount"))[
        "total"
    ] or Decimal("0")

    _code, row_status = collection_status_for_repayment(repayment)

    return {
        "id": _lead_row_id(application),
        "customerId": str(loan.customer_id),
        "leadId": _lead_display_id(application, loan),
        "loanNo": loan.loan_account_number,
        "branch": _branch_name(loan, application, _approved_decision(application)),
        "name": loan.customer.full_name,
        "email": loan.customer.email or "—",
        "mob": loan.customer.mobile_number or "—",
        "pan": CustomerService.get_primary_pan(loan.customer) or "—",
        "state": address.state if address else "—",
        "repayDate": loan.due_date.isoformat() if loan.due_date else "",
        "collectedAmount": _money(repayment.amount),
        "principalAmt": _money(loan.principal_amount),
        "interestAmt": _money(loan.interest_amount),
        "penalInterest": _money(penal_total),
        "collectedMode": repayment.get_payment_mode_display(),
        "referenceNo": repayment.utr or repayment.gateway_reference or "—",
        "waveOff": _money(settlement.waiver_amount if settlement else 0),
        "settelmentAmt": _money(settlement.settlement_amount if settlement else 0),
        "collectionSource": repayment.gateway_reference or repayment.remarks or "—",
        "collectionTeam": _user_label(repayment.collected_by),
        "status": row_status,
        "remarks": repayment.remarks or "—",
        "collectionDateTime": repayment.payment_date.isoformat() if repayment.payment_date else "",
    }


def _build_cibil_row(loan: Loan) -> dict:
    application = loan.application
    decision = _approved_decision(application)
    details = decision.sanction_details or {} if decision else {}
    sheet = _sheet_details(application)
    address = resolve_customer_address(loan.customer)
    bank_defaults = resolve_beneficiary_disbursal_defaults(application) if application else {}

    account_no = (
        _detail_string(sheet, "account_number") or bank_defaults.get("account_number") or ""
    )
    ifsc = _detail_string(sheet, "ifsc_code") or bank_defaults.get("ifsc_code") or ""
    bank_name = _detail_string(sheet, "bank_name") or bank_defaults.get("bank_name") or ""
    bank_branch = _detail_string(sheet, "branch") or bank_defaults.get("branch") or ""

    cibil = _detail_number(details, "cibil_score") if details else 0
    address_lines = []
    if address:
        address_lines = [address.line1, address.line2, address.city]
    address_text = ", ".join(part for part in address_lines if part)

    return {
        "id": _lead_row_id(application),
        "customerId": str(loan.customer_id),
        "leadId": _lead_display_id(application, loan),
        "loanNo": loan.loan_account_number,
        "name": loan.customer.full_name,
        "dob": loan.customer.dob.isoformat() if loan.customer.dob else "",
        "gender": loan.customer.get_gender_display() if loan.customer.gender else "—",
        "pan": CustomerService.get_primary_pan(loan.customer) or "—",
        "adharCard": CustomerService.get_primary_aadhaar(loan.customer) or "—",
        "mob": loan.customer.mobile_number or "—",
        "email": loan.customer.email or "—",
        "address": address_text or "—",
        "addressCategory": address.get_address_type_display() if address else "—",
        "addressType": address.get_address_type_display() if address else "—",
        "state": address.state if address else "—",
        "pinCode": address.pincode if address else "—",
        "disbursalDate": loan.disbursed_at.date().isoformat() if loan.disbursed_at else "",
        "repayDate": loan.due_date.isoformat() if loan.due_date else "",
        "tenure": str(_tenure_days(loan, application, decision)),
        "roi": _money(loan.interest_rate),
        "loanAmt": _money(loan.principal_amount),
        "repayAmt": _money(loan.total_repayable),
        "accountNo": account_no,
        "ifscCode": ifsc,
        "bankBranch": bank_branch,
        "bankName": bank_name,
        "cibilScore": _str(int(cibil)) if cibil else "0",
    }


class AllReportingService:
    @staticmethod
    def _paginate_queryset(qs, *, page: int, page_size: int):
        """Slice a queryset or materialized list without building all rows first."""
        if isinstance(qs, list):
            total = len(qs)
            start = (page - 1) * page_size
            return total, qs[start : start + page_size]
        total = qs.count()
        start = (page - 1) * page_size
        return total, list(qs[start : start + page_size])

    @staticmethod
    def get_filter_options(*, user) -> dict:
        """Branch/state dropdown values from a capped loan sample (avoids full-table scan)."""
        loans = _visible_loans_queryset(user)
        if isinstance(loans, list):
            loan_iter = loans[:500]
        else:
            loan_iter = loans.select_related("application", "customer").prefetch_related(
                "application__decisions",
                "customer__addresses",
            )[:500]
        branches: set[str] = set()
        states: set[str] = set()
        for loan in loan_iter:
            application = loan.application
            decision = _approved_decision(application)
            branch = _branch_name(loan, application, decision)
            if branch and branch != "—":
                branches.add(branch)
            address = resolve_customer_address(loan.customer)
            if address and address.state:
                states.add(address.state)
        return {
            "branches": sorted(branches),
            "states": sorted(states),
        }

    @staticmethod
    def get_disbursed_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = _visible_loans_queryset(user)
        total, page_items = AllReportingService._paginate_queryset(
            qs, page=page, page_size=page_size
        )
        return {
            "count": total,
            "results": [_build_disbursed_row(loan) for loan in page_items],
        }

    @staticmethod
    def get_collection_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = _visible_repayments_queryset(user)
        total, page_items = AllReportingService._paginate_queryset(
            qs, page=page, page_size=page_size
        )
        return {
            "count": total,
            "results": [_build_collection_row(repayment) for repayment in page_items],
        }

    @staticmethod
    def get_cibil_rows(*, user, page: int = 1, page_size: int = 50) -> dict:
        qs = _visible_loans_queryset(user)
        total, page_items = AllReportingService._paginate_queryset(
            qs, page=page, page_size=page_size
        )
        return {
            "count": total,
            "results": [_build_cibil_row(loan) for loan in page_items],
        }

    @staticmethod
    def disbursed_loans_report(*, user):
        return AllReportingService.get_disbursed_rows(user=user)["results"]

    @staticmethod
    def lead_pipeline_report(*, user):
        from apps.leads.services.lead_service import LeadService

        qs = LeadService.visible_leads_for(user)
        return list(
            qs.values(
                "lead_id",
                "status",
                "category",
                "required_amount",
                "customer__customer_code",
            )
        )
