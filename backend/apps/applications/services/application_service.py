from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.services.role_helpers import user_has_permission
from apps.activities.services.activity_service import ActivityService
from apps.applications.models import (
    ApplicationDecision,
    ApplicationStatus,
    LoanApplication,
)
from apps.applications.selectors.application_selectors import SANCTION_PENDING_STATUSES
from apps.applications.services.application_status_service import (
    change_application_status,
    ensure_application_submitted_at,
    record_application_status_created,
)
from apps.applications.services.disbursal_sheet_service import (
    DisbursalSheetService,
    DisbursalSheetServiceError,
)
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.applications.services.sanction_salary_bank_service import (
    SanctionSalaryBankServiceError,
    prepare_sanction_details,
    sync_decision_salary_banks,
)
from apps.applications.services.snapshot_service import (
    build_customer_snapshot,
    build_product_snapshot,
)
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.core.services.ifsc_service import IfscLookupError, apply_ifsc_bank_details
from apps.customers.services.bank_account_service import (
    BankAccountService,
    BankAccountServiceError,
)
from apps.leads.models import LeadStatus
from apps.leads.services.lead_conversion_service import LeadConversionService
from apps.leads.services.lead_status_service import change_lead_status
from apps.loans.services.loan_service import LoanService, LoanServiceError
from apps.notifications.services.notification_service import NotificationService
from apps.organization.models import Branch
from apps.products.services.workflow_resolver import (
    initial_workflow_state,
    resolve_default_workflow,
)
from apps.workflow.models import WorkflowTransition


class ApplicationServiceError(Exception):
    pass


class ApplicationService:
    SUBMITTABLE_STATUSES = frozenset(
        {
            ApplicationStatus.INTERESTED,
            ApplicationStatus.DOCUMENTS_RECEIVED,
        }
    )
    DECIDABLE_STATUSES = frozenset(
        {
            ApplicationStatus.DOCUMENTS_VERIFIED,
        }
    )
    REVISABLE_STATUSES = frozenset(
        {
            ApplicationStatus.APPROVED,
            ApplicationStatus.REJECTED,
        }
    )
    POST_SANCTION_REJECTION_STATUSES = frozenset(
        {
            ApplicationStatus.APPROVED,
            ApplicationStatus.DISBURSAL_SHEET_SENT,
        }
    )
    REJECTION_BLOCKED_STATUSES = frozenset(
        {
            ApplicationStatus.DISBURSED,
            ApplicationStatus.CANCELLED,
        }
    )
    REJECTABLE_STATUSES = SANCTION_PENDING_STATUSES
    DISBURSAL_SHEET_STATUSES = frozenset(
        {
            ApplicationStatus.APPROVED,
            ApplicationStatus.DISBURSAL_SHEET_SENT,
        }
    )

    @staticmethod
    def _json_safe(value):
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, dict):
            return {key: ApplicationService._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [ApplicationService._json_safe(item) for item in value]
        return value

    @staticmethod
    def _next_application_number() -> str:
        last = LoanApplication.all_objects.order_by("-created_at").first()
        seq = 1
        if last and last.application_number:
            digits = "".join(ch for ch in last.application_number if ch.isdigit())
            if digits:
                seq = int(digits) + 1
        return f"APP{seq:06d}"

    @classmethod
    @transaction.atomic
    def create_application(cls, *, user, customer, product, data: dict) -> LoanApplication:
        workflow = resolve_default_workflow()
        tenure_value = data.get("tenure_value", product.min_tenure)
        application = LoanApplication.objects.create(
            application_number=cls._next_application_number(),
            customer=customer,
            product=product,
            requested_amount=data["requested_amount"],
            tenure_value=tenure_value,
            tenure_unit=data.get("tenure_unit", product.tenure_unit),
            purpose=data.get("purpose", ""),
            branch_id=data.get("branch_id"),
            status=ApplicationStatus.INTERESTED,
            workflow=workflow,
            current_state=initial_workflow_state(workflow),
            assigned_rm=data.get("assigned_rm"),
            assigned_cm=data.get("assigned_cm"),
            customer_snapshot=build_customer_snapshot(customer),
            product_snapshot=build_product_snapshot(product, tenure_value=tenure_value),
            created_by=user,
            updated_by=user,
        )
        ActivityService.log(
            actor=user,
            verb="created",
            description="Loan Application Created",
            target=application,
        )
        record_application_status_created(application=application, user=user)
        return application

    @classmethod
    def _ensure_submitted_at(cls, application: LoanApplication) -> bool:
        return ensure_application_submitted_at(application)

    @classmethod
    def _advance_to_documents_verified(cls, *, user, application: LoanApplication) -> None:
        submitted_updated = cls._ensure_submitted_at(application)
        change_application_status(
            application=application,
            new_status=ApplicationStatus.DOCUMENTS_VERIFIED,
            user=user,
            remarks="Documents verified",
            extra_update_fields=["submitted_at"] if submitted_updated else None,
        )

    @classmethod
    @transaction.atomic
    def submit(cls, *, user, application: LoanApplication) -> LoanApplication:
        if application.status not in cls.SUBMITTABLE_STATUSES:
            raise ApplicationServiceError(
                "Application cannot be submitted from its current status."
            )
        cls._advance_to_documents_verified(user=user, application=application)
        return application

    @classmethod
    def _apply_sanction_details(
        cls,
        *,
        application: LoanApplication,
        sanction_details: dict | None,
        user,
    ) -> None:
        if not sanction_details:
            return
        loan_purpose = sanction_details.get("loan_purpose")
        if loan_purpose:
            application.purpose = loan_purpose
        branch_name = sanction_details.get("branch")
        if branch_name:
            branch = Branch.objects.filter(branch_name=branch_name, status="active").first()
            if branch:
                application.branch = branch
        application.updated_by = user

    @classmethod
    def _assert_can_decide(
        cls,
        *,
        user,
        application: LoanApplication,
        decision: str,
    ) -> None:
        status = application.status

        if decision == "rejected":
            if status in cls.REJECTION_BLOCKED_STATUSES:
                raise ApplicationServiceError(
                    "Disbursed or cancelled applications cannot be rejected."
                )
            if status == ApplicationStatus.REJECTED:
                if not user_has_permission(user, "application.update"):
                    raise ApplicationServiceError(
                        "You do not have permission to update an existing rejection decision."
                    )
                return
            if status in cls.POST_SANCTION_REJECTION_STATUSES:
                return
            if status in cls.REJECTABLE_STATUSES:
                return
            raise ApplicationServiceError("Application is not in a decidable state.")

        if status in cls.REVISABLE_STATUSES:
            if not user_has_permission(user, "application.update"):
                raise ApplicationServiceError(
                    "You do not have permission to update an existing sanction or rejection decision."
                )
            return
        if status in cls.DECIDABLE_STATUSES or status in cls.SUBMITTABLE_STATUSES:
            return
        raise ApplicationServiceError("Application is not in a decidable state.")

    @classmethod
    def _cleanup_on_rejection(cls, *, user, application: LoanApplication) -> None:
        loan = getattr(application, "loan", None)
        if loan is None or loan.is_deleted:
            return
        if loan.disbursed_at:
            raise ApplicationServiceError("Disbursed loans cannot be rejected.")
        loan.is_deleted = True
        loan.updated_by = user
        loan.save(update_fields=["is_deleted", "updated_by", "updated_at"])

    @classmethod
    def _sync_lead_on_rejection(
        cls,
        *,
        user,
        application: LoanApplication,
        rejection_reason: str,
        remarks: str,
    ) -> None:
        if not application.lead_id:
            return
        lead = application.lead
        lead.rejection_reason = rejection_reason
        if lead.status == LeadStatus.NOT_INTERESTED:
            lead.updated_by = user
            lead.save(update_fields=["rejection_reason", "updated_by", "updated_at"])
            return
        if lead.status in (LeadStatus.LOAN_RUNNING, LeadStatus.CLOSED):
            change_lead_status(
                lead=lead,
                new_status=LeadStatus.NOT_INTERESTED,
                user=user,
                remarks=rejection_reason or remarks or "Application rejected",
                extra_update_fields=["rejection_reason"],
            )
            return
        from apps.leads.models import TERMINAL_LEAD_STATUSES

        if lead.status not in TERMINAL_LEAD_STATUSES:
            change_lead_status(
                lead=lead,
                new_status=LeadStatus.NOT_INTERESTED,
                user=user,
                remarks=rejection_reason or remarks or "Application rejected",
                extra_update_fields=["rejection_reason"],
            )

    @classmethod
    @transaction.atomic
    def decide(
        cls,
        *,
        user,
        application: LoanApplication,
        decision: str,
        approved_amount: Decimal | None = None,
        approved_tenure_value: int | None = None,
        interest_rate: Decimal | None = None,
        processing_fee: Decimal | None = None,
        rejection_reason: str = "",
        remarks: str = "",
        sanction_details: dict | None = None,
    ) -> LoanApplication:
        cls._assert_can_decide(user=user, application=application, decision=decision)
        submitted_updated = cls._ensure_submitted_at(application)
        if decision == "approved" and application.status in cls.SUBMITTABLE_STATUSES:
            cls._advance_to_documents_verified(user=user, application=application)

        resolved_processing_fee = processing_fee
        resolved_sanction_details = sanction_details
        if decision == "approved":
            principal = approved_amount or application.requested_amount
            try:
                resolved_sanction_details = prepare_sanction_details(sanction_details)
            except SanctionSalaryBankServiceError as exc:
                raise ApplicationServiceError(str(exc)) from exc
            resolved_processing_fee, resolved_sanction_details = (
                SanctionFeeService.apply_to_sanction(
                    approved_amount=principal,
                    sanction_details=resolved_sanction_details,
                    processing_fee=processing_fee,
                )
            )
            salary_accounts = [
                str(entry.get("account_number") or "").strip()
                for entry in (resolved_sanction_details or {}).get("salary_banks") or []
                if isinstance(entry, dict)
            ]
            legacy_account = (resolved_sanction_details or {}).get("salary_account")
            if legacy_account:
                salary_accounts.append(str(legacy_account).strip())
            checked_accounts: set[str] = set()
            for salary_account in salary_accounts:
                normalized_account = salary_account.strip()
                if not normalized_account or normalized_account in checked_accounts:
                    continue
                checked_accounts.add(normalized_account)
                try:
                    BankAccountService.assert_account_number_available(
                        normalized_account,
                        customer_id=application.customer_id,
                        application_id=application.id,
                    )
                except BankAccountServiceError as exc:
                    raise ApplicationServiceError(str(exc)) from exc

        decision_record = ApplicationDecision.objects.create(
            application=application,
            decision=decision,
            decided_by=user,
            approved_amount=approved_amount,
            approved_tenure_value=approved_tenure_value,
            interest_rate=interest_rate,
            processing_fee=resolved_processing_fee,
            rejection_reason=rejection_reason,
            remarks=remarks,
            sanction_details=cls._json_safe(resolved_sanction_details or {}),
            created_by=user,
            updated_by=user,
        )

        if decision == "approved":
            try:
                sync_decision_salary_banks(
                    decision=decision_record,
                    sanction_details=resolved_sanction_details,
                )
            except SanctionSalaryBankServiceError as exc:
                raise ApplicationServiceError(str(exc)) from exc
            application.approved_amount = approved_amount or application.requested_amount
            cls._apply_sanction_details(
                application=application,
                sanction_details=resolved_sanction_details,
                user=user,
            )
            application.decided_at = timezone.now()
            approve_fields = ["approved_amount", "decided_at", "purpose", "branch"]
            if submitted_updated:
                approve_fields.append("submitted_at")
            change_application_status(
                application=application,
                new_status=ApplicationStatus.APPROVED,
                user=user,
                remarks=remarks or "Application approved",
                extra_update_fields=approve_fields,
            )
            if application.lead_id:
                LeadConversionService.sync_application_on_sanction_approved(
                    user=user,
                    application=application,
                )
            NotificationService.notify_application_approved(application)
            NotificationService.send_sanction_approved_email(
                application,
                decision=decision_record,
                raise_on_error=False,
            )
            try:
                LoanService.create_from_application(user=user, application=application)
            except LoanServiceError as exc:
                if "already exists" not in str(exc).lower():
                    raise ApplicationServiceError(str(exc)) from exc
        else:
            cls._cleanup_on_rejection(user=user, application=application)
            application.decided_at = timezone.now()
            reject_fields = ["decided_at"]
            if submitted_updated:
                reject_fields.append("submitted_at")
            change_application_status(
                application=application,
                new_status=ApplicationStatus.REJECTED,
                user=user,
                remarks=rejection_reason or remarks or "Application rejected",
                extra_update_fields=reject_fields,
            )
            cls._sync_lead_on_rejection(
                user=user,
                application=application,
                rejection_reason=rejection_reason,
                remarks=remarks,
            )

        app_label = application.application_number or str(application.pk)
        if decision == "approved":
            UserActivityService.log(
                user=user,
                action=UserActivityAction.APPROVE,
                description=f"Approved application {app_label}",
                metadata={"application_id": str(application.pk), "decision": decision},
            )
        else:
            UserActivityService.log(
                user=user,
                action=UserActivityAction.REJECT,
                description=f"Rejected application {app_label}",
                metadata={
                    "application_id": str(application.pk),
                    "decision": decision,
                    "rejection_reason": rejection_reason or remarks,
                },
            )

        return (
            LoanApplication.objects.select_related("customer", "product", "branch", "lead")
            .prefetch_related("decisions")
            .get(pk=application.pk)
        )

    @classmethod
    def send_sanction_approved_email(cls, *, user, application: LoanApplication) -> LoanApplication:
        if application.status != ApplicationStatus.APPROVED:
            raise ApplicationServiceError(
                "Sanction email can only be sent for approved applications."
            )
        latest = application.decisions.filter(decision="approved").order_by("-decided_at").first()
        if latest is None:
            raise ApplicationServiceError(
                "No approved sanction decision found for this application."
            )
        try:
            NotificationService.send_sanction_approved_email(application, decision=latest)
        except ApplicationServiceError:
            raise
        except Exception as exc:
            raise ApplicationServiceError(str(exc)) from exc
        return application

    @classmethod
    @transaction.atomic
    def submit_disbursal_sheet(
        cls,
        *,
        user,
        application: LoanApplication,
        disbursal_details: dict,
    ) -> LoanApplication:
        if application.status not in cls.DISBURSAL_SHEET_STATUSES:
            raise ApplicationServiceError(
                "Disbursal sheet can only be submitted for approved applications."
            )
        net = SanctionFeeService.net_disbursal_for_application(application)
        details = dict(disbursal_details or {})
        try:
            BankAccountService.assert_account_number_available(
                details.get("account_number"),
                customer_id=application.customer_id,
                application_id=application.id,
            )
        except BankAccountServiceError as exc:
            raise ApplicationServiceError(str(exc)) from exc
        try:
            DisbursalSheetService.assert_cheque_number_available(
                details.get("cheque_no"),
                application_id=application.id,
            )
        except DisbursalSheetServiceError as exc:
            raise ApplicationServiceError(str(exc)) from exc
        try:
            details = apply_ifsc_bank_details(details)
        except IfscLookupError as exc:
            raise ApplicationServiceError(str(exc)) from exc
        details.pop("disbursal_date", None)
        details["amount_to_be_disbursed"] = net["amount_to_be_disbursed"]
        details["total_deduction"] = net["total_deduction"]
        details["processing_fee"] = net["processing_fee"]
        details["gst"] = net["gst"]
        details["disbursal_date"] = timezone.localdate().isoformat()
        application.disbursal_sheet_details = cls._json_safe(details)
        application.disbursal_sheet_sent_at = timezone.now()
        change_application_status(
            application=application,
            new_status=ApplicationStatus.DISBURSAL_SHEET_SENT,
            user=user,
            remarks="Disbursal sheet sent",
            extra_update_fields=["disbursal_sheet_details", "disbursal_sheet_sent_at"],
        )
        NotificationService.notify_disbursal_sheet_sent(application)
        app_label = application.application_number or str(application.pk)
        UserActivityService.log(
            user=user,
            action=UserActivityAction.SUBMIT,
            description=f"Submitted disbursal sheet for application {app_label}",
            metadata={"application_id": str(application.pk)},
        )
        return application

    @classmethod
    def transition(cls, *, user, application: LoanApplication, action: str) -> LoanApplication:
        if not application.workflow or not application.current_state:
            raise ApplicationServiceError("Application has no workflow configured.")
        transition = (
            WorkflowTransition.objects.filter(
                workflow=application.workflow,
                from_state=application.current_state,
                action=action,
            )
            .select_related("to_state")
            .first()
        )
        if not transition:
            raise ApplicationServiceError(f"Transition '{action}' is not allowed.")
        application.current_state = transition.to_state
        application.updated_by = user
        application.save(update_fields=["current_state", "updated_by", "updated_at"])
        return application
