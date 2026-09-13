from decimal import Decimal

from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import (
    HasRBACPermission,
    RBACActionPermissionMixin,
    rbac_any_permission,
    rbac_permission,
    require_rbac,
)
from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.accounts.services.role_helpers import is_admin_user, is_super_admin
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.collections.models import CollectionActivityType
from apps.collections.services.collection_activity_service import CollectionActivityService
from apps.core.responses import error_response, success_response
from apps.customers.services.customer_service import CustomerService
from apps.leads.constants import MAX_LEADS_PER_CUSTOMER_PER_HOUR
from apps.leads.models import LeadCategory, LeadFollowUpRemark, LeadSource, LeadStatus
from apps.leads.permissions import LeadObjectPermission
from apps.leads.selectors.lead_list_selectors import (
    constrain_leads_to_status_display,
    exclude_leads_from_fresh_reloan_category,
    exclude_leads_with_status_wise_call_disposition,
    filter_leads_by_application_status,
    filter_leads_by_latest_call_disposition,
    fresh_or_reloan_status_count_filter,
)
from apps.leads.selectors.lead_selectors import get_lead_detail
from apps.leads.serializers import (
    CallLogSerializer,
    LeadConvertSerializer,
    LeadCreateSerializer,
    LeadFollowUpRemarkSerializer,
    LeadListSerializer,
    LeadSourceSerializer,
    LeadTransferSerializer,
    LeadUpdateSerializer,
)
from apps.leads.serializers.lead_serializers import _user_label
from apps.leads.services.call_log_service import CallLogService
from apps.leads.services.lead_conversion_service import LeadConversionError, LeadConversionService
from apps.leads.services.lead_initial_status_service import resolve_initial_lead_status
from apps.leads.services.lead_intake_service import LeadIntakeError, LeadIntakeService
from apps.leads.services.lead_service import LeadService, LeadServiceError
from apps.leads.utils.lead_enrichment import (
    resolve_beneficiary_disbursal_defaults,
    resolve_company_disbursal_account,
)
from apps.leads.views.lead_detail_actions import LeadDetailActionsMixin
from apps.loans.services.loan_calculation_service import LoanCalculationService
from apps.products.models import LoanProduct
from apps.repayments.models import RepaymentStatus
from apps.repayments.services.collection_status_service import collection_row_for_repayment


class LeadViewSet(RBACActionPermissionMixin, LeadDetailActionsMixin, viewsets.ModelViewSet):
    permission_classes = [LeadObjectPermission]
    filterset_fields = ["status", "category", "source", "customer"]
    search_fields = [
        "lead_id",
        "customer__first_name",
        "customer__last_name",
        "customer__email",
        "customer__mobile_number",
    ]
    ordering_fields = [
        "created_at",
        "submitted_at",
        "lead_id",
        "status",
        "category",
        "required_amount",
        "customer__first_name",
        "customer__last_name",
    ]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    rbac_default_permission = "lead.view"
    rbac_crud_permissions = {
        "create": "lead.create",
        "update": "lead.update",
        "partial_update": "lead.update",
        "destroy": "lead.delete",
    }

    def get_serializer_class(self):
        if self.action == "create":
            return LeadCreateSerializer
        if self.action in ("update", "partial_update"):
            return LeadUpdateSerializer
        if self.action == "convert":
            return LeadConvertSerializer
        return LeadListSerializer

    def get_queryset(self):
        qs = LeadService.visible_leads_for(self.request.user)
        application_status = self.request.query_params.get("application_status")
        if application_status:
            qs = filter_leads_by_application_status(qs, application_status)

        call_disposition = self.request.query_params.get("call_disposition")
        if call_disposition:
            qs = filter_leads_by_latest_call_disposition(qs, call_disposition)

        # Optional created_at range for list pages (ISO dates: date_from, date_to).
        date_from = parse_date(self.request.query_params.get("date_from") or "")
        date_to = parse_date(self.request.query_params.get("date_to") or "")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")
        if category in (LeadCategory.FRESH, LeadCategory.RELOAN) or status in (
            LeadStatus.FRESH,
            LeadStatus.RELOAN,
        ):
            qs = exclude_leads_from_fresh_reloan_category(qs)
            if status in (LeadStatus.FRESH, LeadStatus.RELOAN):
                qs = exclude_leads_with_status_wise_call_disposition(qs)
        if status:
            qs = constrain_leads_to_status_display(qs, status)
        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    @rbac_any_permission(
        "lead.view", "disbursal.view", "loan.view", "report.view", "collection.view"
    )
    def summary(self, request):
        """Aggregate fresh/reloan/total counts for the current list filters (no row payload)."""
        qs = self.filter_queryset(self.get_queryset())
        counts = qs.aggregate(
            total=Count("id"),
            fresh=Count("id", filter=fresh_or_reloan_status_count_filter(LeadStatus.FRESH)),
            reloan=Count("id", filter=fresh_or_reloan_status_count_filter(LeadStatus.RELOAN)),
        )
        return success_response(data=counts)

    @rbac_any_permission(
        "lead.view", "disbursal.view", "loan.view", "report.view", "collection.view"
    )
    def list(self, request, *args, **kwargs):
        """Finance/collection open lead detail from pipeline tables without lead.view alone."""
        return super().list(request, *args, **kwargs)

    @rbac_any_permission(
        "lead.view", "disbursal.view", "loan.view", "report.view", "collection.view"
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = LeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            lead = LeadIntakeService.create_from_validated_data(
                user=request.user,
                data=serializer.validated_data,
            )
        except LeadIntakeError as exc:
            return error_response(
                message=exc.message,
                errors=exc.errors,
                status_code=exc.status_code,
            )
        return success_response(
            data=LeadListSerializer(lead).data,
            message="Lead created",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("lead.convert")
    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadConvertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            product = LoanProduct.objects.get(
                id=serializer.validated_data["product_id"],
                is_active=True,
            )
        except LoanProduct.DoesNotExist:
            return error_response(message="Product not found", status_code=404)
        try:
            application = LeadConversionService.convert_lead(
                user=request.user,
                lead=lead,
                product=product,
                requested_amount=serializer.validated_data.get("requested_amount"),
                tenure_value=serializer.validated_data.get("tenure_value"),
            )
        except LeadConversionError as exc:
            return error_response(message=str(exc), status_code=400)
        from apps.applications.serializers.application_serializers import LoanApplicationSerializer

        return success_response(
            data={
                "lead": LeadListSerializer(get_lead_detail(lead.id)).data,
                "application": LoanApplicationSerializer(application).data,
            },
            message="Lead converted to loan application",
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        perms = resolve_user_permissions(request.user)
        if not is_super_admin(request.user) and "lead.update" not in perms:
            return error_response(
                message="You are not allowed to edit leads.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        lead = self.get_object()
        serializer = LeadUpdateSerializer(
            lead, data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        lead = LeadService.update_lead(
            user=request.user,
            lead=lead,
            data=serializer.validated_data,
        )
        return success_response(
            data=LeadListSerializer(get_lead_detail(lead.id)).data,
            message="Lead updated",
        )

    def destroy(self, request, *args, **kwargs):
        lead = self.get_object()
        LeadService.delete_lead(user=request.user, lead=lead)
        return success_response(message="Lead deleted")

    @rbac_permission("lead.assign")
    @action(detail=True, methods=["post"], url_path="transfer")
    def transfer(self, request, pk=None):
        # lead.assign gates the RBAC decorator; only Super Admin / Admin may transfer
        # (RM roster auto-assignment on create does not use this endpoint or lead.assign).
        if not (is_super_admin(request.user) or is_admin_user(request.user)):
            return error_response(
                message="Only Super Admin or Admin can transfer leads.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        lead = self.get_object()
        serializer = LeadTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            new_rm = User.objects.get(pk=serializer.validated_data["new_rm"], is_active=True)
        except User.DoesNotExist:
            return error_response(message="Target relationship manager not found", status_code=404)
        try:
            lead = LeadService.transfer_lead(
                user=request.user,
                lead=lead,
                new_rm=new_rm,
                remarks=serializer.validated_data.get("remarks", ""),
            )
        except LeadServiceError as exc:
            return error_response(message=str(exc), status_code=400)
        lead = get_lead_detail(lead.id)
        return success_response(
            data=LeadListSerializer(lead).data,
            message="Lead transferred",
        )

    @rbac_any_permission("disbursal.view", "disbursal.create", "loan.view", "collection.view")
    @action(detail=True, methods=["get"], url_path="disbursal")
    def disbursal(self, request, pk=None):
        """Disbursal sheet + loan summary for Lead Details (calculations via LoanCalculationService)."""
        lead = self.get_object()
        from apps.leads.services.lead_conversion_service import LeadConversionService

        # Prefer the disbursed application when converted_application is a later file.
        application = LeadConversionService.resolve_pipeline_application(lead)
        fi_investigators = LeadService.field_investigator_roster()

        empty_summary = LoanCalculationService.compute_summary(
            principal_amount=Decimal("0"),
            roi_percent=Decimal("0"),
            disbursal_type=None,
        ).as_api_dict()

        if not application:
            return success_response(
                data={
                    "stage": "none",
                    "disbursal": None,
                    "net_disbursal": SanctionFeeService.compute_net_disbursal(
                        principal_amount=0,
                        pf_percentage=0,
                    ),
                    "loan_summary": empty_summary,
                    "fi_investigators": fi_investigators,
                    "application_status": None,
                    "application_status_display": None,
                    "company_account_profile": None,
                }
            )

        loan = getattr(application, "loan", None)
        details = dict(application.disbursal_sheet_details or {})
        lender_branch = str((application.branch.branch_name if application.branch else "") or "")
        metrics = LoanCalculationService.compute_for_application(application, loan=loan)
        status_display = application.get_status_display()
        net_disbursal = SanctionFeeService.net_disbursal_for_application(application)
        company_account = resolve_company_disbursal_account(branch=application.branch)
        company_account_profile = None
        if company_account:
            company_account_profile = {
                "id": str(company_account.id),
                "account_name": company_account.account_name,
                "account_number": company_account.account_number,
                "ifsc_code": company_account.ifsc_code,
                "bank_name": company_account.bank_name,
            }
        disbursal_defaults = resolve_beneficiary_disbursal_defaults(application)

        def _company_account_number(sheet_details: dict) -> str:
            if sheet_details.get("company_account"):
                return str(sheet_details.get("company_account"))
            if company_account:
                return company_account.account_number
            return ""

        def _latest_sanction_decision(app):
            return app.decisions.order_by("-decided_at").first()

        def _repay_date_for_application(app) -> str:
            decision = _latest_sanction_decision(app)
            if decision and decision.sanction_details:
                raw = str(decision.sanction_details.get("repayment_date") or "").strip()
                return raw[:10] if raw else ""
            return ""

        def _disbursal_row(
            sheet_details: dict,
            *,
            row_id: str,
            disbursed_on: str,
            disbursement_utr: str = "",
            disbursement=None,
        ) -> dict:
            account_number = str(sheet_details.get("account_number") or "")
            if not account_number:
                account_number = disbursal_defaults.get("account_number") or ""
            ifsc_code = str(sheet_details.get("ifsc_code") or "")
            if not ifsc_code:
                ifsc_code = disbursal_defaults.get("ifsc_code") or ""
            bank_name = str(sheet_details.get("bank_name") or "")
            if not bank_name:
                bank_name = disbursal_defaults.get("bank_name") or ""
            beneficiary_branch = str(sheet_details.get("branch") or "")
            if not beneficiary_branch:
                beneficiary_branch = disbursal_defaults.get("branch") or ""
            reference_no = str(sheet_details.get("disbursal_reference_no") or "").strip()
            if not reference_no and disbursement_utr:
                reference_no = str(disbursement_utr).strip()
            loan_no = ""
            if loan:
                loan_no = loan.loan_account_number
            else:
                loan_no = application.application_number

            disbursal_sheet_date = ""
            if application.disbursal_sheet_sent_at:
                disbursal_sheet_date = timezone.localtime(
                    application.disbursal_sheet_sent_at,
                ).isoformat()

            disbursal_date_value = ""
            if loan and loan.disbursed_at:
                disbursal_date_value = timezone.localtime(loan.disbursed_at).isoformat()
            elif application.disbursal_sheet_sent_at:
                disbursal_date_value = timezone.localtime(
                    application.disbursal_sheet_sent_at
                ).isoformat()
            else:
                disbursal_date_value = str(sheet_details.get("disbursal_date") or "")

            repay_amount = str(metrics.repay_amount)

            disbursed_by = ""
            if disbursement and disbursement.disbursed_by_id:
                disbursed_by = _user_label(disbursement.disbursed_by) or ""

            disbursal_type = str(sheet_details.get("disbursal_type") or "")
            if disbursal_type:
                disbursal_type = disbursal_type.title()

            return {
                "id": row_id,
                "loan_no": loan_no,
                "company_account": _company_account_number(sheet_details),
                "salary_account": disbursal_defaults.get("account_number") or "",
                "account_number": account_number,
                "ifsc_code": ifsc_code,
                "bank_name": bank_name,
                "branch": beneficiary_branch,
                "cheque_no": str(sheet_details.get("cheque_no") or ""),
                "enach_id": str(sheet_details.get("enach_id") or ""),
                "fi_date": sheet_details.get("fi_date") or None,
                "fi_type": str(sheet_details.get("fi_type") or ""),
                "fi_done_by": str(sheet_details.get("fi_done_by") or ""),
                "amount_to_be_disbursed": str(
                    sheet_details.get("amount_to_be_disbursed")
                    or net_disbursal["amount_to_be_disbursed"]
                ),
                "total_deduction": str(
                    sheet_details.get("total_deduction") or net_disbursal["total_deduction"]
                ),
                "disbursal_reference_no": reference_no,
                "payment_type": str(sheet_details.get("payment_type") or "IMPS"),
                "disbursal_date": disbursal_date_value,
                "disbursal_sheet_date": disbursal_sheet_date,
                "disbursed_date": str(sheet_details.get("disbursed_date") or ""),
                "disbursal_type": disbursal_type,
                "repay_amount": repay_amount,
                "repay_date": _repay_date_for_application(application),
                "status": status_display,
                "disbursed_by": disbursed_by,
                "lead_transfer_to_legal": str(sheet_details.get("lead_transfer_to_legal") or ""),
                "lead_transfer_date": str(sheet_details.get("lead_transfer_date") or ""),
                "remarks": str(sheet_details.get("remarks") or ""),
                "disbursed_on": disbursed_on,
            }

        stage = "none"
        disbursal_payload = None
        if loan and loan.disbursed_at:
            stage = "disbursed"
            disbursement = loan.disbursements.order_by("-disbursed_at").first()
            disbursal_payload = _disbursal_row(
                details,
                row_id=str(loan.id),
                disbursed_on=loan.disbursed_at.isoformat(),
                disbursement_utr=disbursement.utr_reference if disbursement else "",
                disbursement=disbursement,
            )
        elif application.status == "disbursal_sheet_sent":
            stage = "sheet_sent"
            disbursal_payload = _disbursal_row(
                details,
                row_id=str(loan.id) if loan else str(application.id),
                disbursed_on=(
                    (application.disbursal_sheet_sent_at or application.updated_at).isoformat()
                    if (application.disbursal_sheet_sent_at or application.updated_at)
                    else ""
                ),
            )

        return success_response(
            data={
                "stage": stage,
                "disbursal": disbursal_payload,
                "net_disbursal": net_disbursal,
                "loan_summary": metrics.as_api_dict(branch=lender_branch),
                "fi_investigators": fi_investigators,
                "application_status": application.status,
                "application_status_display": status_display,
                "company_account_profile": company_account_profile,
                "disbursal_defaults": disbursal_defaults,
            }
        )

    @rbac_any_permission(
        "call_log.view", "lead.view", "loan.view", "collection.view", "disbursal.view"
    )
    @action(detail=True, methods=["get", "post"], url_path="call-logs")
    def call_logs(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            logs = lead.call_logs.select_related("created_by").all()
            return success_response(data=CallLogSerializer(logs, many=True).data)

        require_rbac(self, request, permission="call_log.create")
        serializer = CallLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        call_log = CallLogService.log(
            user=request.user,
            lead=lead,
            disposition=serializer.validated_data["disposition"],
            remarks=serializer.validated_data.get("remarks", ""),
        )
        return success_response(
            data=CallLogSerializer(call_log).data,
            message="Call logged",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_any_permission("lead.view", "collection.view")
    @action(detail=True, methods=["get"], url_path="collections")
    def collections(self, request, pk=None):
        lead = self.get_object()
        application = (
            lead.applications.filter(is_deleted=False)
            .select_related("loan")
            .order_by("-created_at")
            .first()
        )
        if application is None:
            return success_response(data=[])
        loan = getattr(application, "loan", None)
        if loan is None or loan.is_deleted:
            return success_response(data=[])
        repayments = loan.repayments.filter(status=RepaymentStatus.CONFIRMED).order_by(
            "-payment_date", "-created_at"
        )
        return success_response(
            data=[collection_row_for_repayment(repayment) for repayment in repayments]
        )

    @rbac_any_permission(
        "lead.view", "loan.view", "collection.view", "disbursal.view", "call_log.view"
    )
    @action(detail=True, methods=["get", "post"], url_path="follow-up-remarks")
    def follow_up_remarks(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            remarks = lead.follow_up_remarks.all()
            return success_response(data=LeadFollowUpRemarkSerializer(remarks, many=True).data)

        require_rbac(self, request, permissions=["call_log.create", "collection.create"])
        serializer = LeadFollowUpRemarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remark = LeadFollowUpRemark.objects.create(
            lead=lead,
            created_by=request.user,
            remark_category=serializer.validated_data["remark_category"],
            follow_up_date=serializer.validated_data.get("follow_up_date"),
            priority=serializer.validated_data["priority"],
            notes=serializer.validated_data["notes"],
        )
        follow_up_date = serializer.validated_data.get("follow_up_date")
        next_follow_up = None
        if follow_up_date:
            from datetime import datetime, time

            next_follow_up = timezone.make_aware(datetime.combine(follow_up_date, time.min))
        CollectionActivityService.log_for_lead(
            lead=lead,
            user=request.user,
            activity_type=CollectionActivityType.CALL,
            outcome="follow_up_remark",
            notes=serializer.validated_data["notes"],
            next_follow_up=next_follow_up,
        )
        return success_response(
            data=LeadFollowUpRemarkSerializer(remark).data,
            message="Follow-up remark saved",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_any_permission("lead.view", "collection.view")
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"follow-up-remarks/(?P<remark_id>[^/.]+)",
    )
    def follow_up_remark_detail(self, request, pk=None, remark_id=None):
        lead = self.get_object()
        try:
            remark = lead.follow_up_remarks.get(id=remark_id)
        except LeadFollowUpRemark.DoesNotExist:
            return error_response(message="Remark not found", status_code=404)

        if request.method == "DELETE":
            require_rbac(
                self,
                request,
                permissions=["collection.delete", "collection.create", "call_log.create"],
            )
            remark.delete()
            return success_response(message="Follow-up remark deleted")

        require_rbac(
            self,
            request,
            permissions=["collection.update", "collection.create", "call_log.create"],
        )
        serializer = LeadFollowUpRemarkSerializer(remark, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        remark = serializer.save()
        return success_response(
            data=LeadFollowUpRemarkSerializer(remark).data,
            message="Follow-up remark updated",
        )


class CustomerLookupAPIView(APIView):
    permission_classes = [HasRBACPermission]
    # Used during lead intake; CM/Sr. CM have lead.view/create but not customer.view.
    required_permissions = ["customer.view", "lead.view", "lead.create"]

    def get(self, request):
        pan = (request.query_params.get("pan") or "").strip() or None
        aadhaar = (request.query_params.get("aadhaar") or "").strip() or None
        email = (request.query_params.get("email") or "").strip() or None
        mobile = (
            request.query_params.get("mobile_number") or request.query_params.get("mobile") or ""
        ).strip() or None

        if not any((pan, aadhaar, email, mobile)):
            return error_response(
                message="Provide at least one of PAN, Aadhaar, email, or mobile number.",
                status_code=400,
            )

        customer = CustomerService.find_by_identifiers(
            pan=pan,
            aadhaar=aadhaar,
            email=email,
            mobile=mobile,
        )
        if customer is None:
            return success_response(data={"exists": False})

        active_lead = LeadService.check_existing_active_lead(customer)
        recent_count = LeadService.recent_lead_count(customer)
        active_payload = None
        if active_lead is not None:
            rm = active_lead.assigned_rm
            active_payload = {
                "lead_id": active_lead.lead_id,
                "status": active_lead.status,
                "assigned_rm_name": (rm.get_full_name().strip() or rm.email) if rm else None,
                "assigned_rm_email": rm.email if rm else None,
            }

        return success_response(
            data={
                "exists": True,
                "customer": CustomerService.customer_lookup_payload(customer),
                "active_lead": active_payload,
                "leads_created_last_hour": recent_count,
                "can_create_lead": recent_count < MAX_LEADS_PER_CUSTOMER_PER_HOUR,
                "suggested_initial_status": resolve_initial_lead_status(customer),
            }
        )


class LeadSourceListAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "lead.view"

    def get(self, request):
        sources = LeadSource.objects.filter(is_active=True)
        return success_response(data=LeadSourceSerializer(sources, many=True).data)
