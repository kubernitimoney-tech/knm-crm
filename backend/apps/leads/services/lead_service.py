import logging
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from apps.accounts.models import UserRole
from apps.accounts.services.role_helpers import (
    CREDIT_MANAGER_SLUGS,
    FIELD_INVESTIGATOR_SLUGS,
    RELATIONSHIP_MANAGER_SLUGS,
    is_super_admin,
)
from apps.activities.services.activity_service import ActivityService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.leads.constants import MAX_LEADS_PER_CUSTOMER_PER_HOUR
from apps.leads.models import (
    TERMINAL_LEAD_STATUSES,
    Lead,
    LeadAssignmentHistory,
    LeadCategory,
)
from apps.leads.services.lead_conversion_service import LeadConversionService
from apps.leads.services.lead_initial_status_service import (
    resolve_initial_lead_category,
    resolve_initial_lead_status,
)
from apps.leads.services.lead_status_service import change_lead_status, record_lead_status_created

RELATIONSHIP_MANAGER_SLUG = "relationship-manager"
CREDIT_MANAGER_SLUG = "credit-manager"

logger = logging.getLogger(__name__)


class LeadServiceError(Exception):
    pass


class LeadService:
    @staticmethod
    def _next_lead_id() -> str:
        last = Lead.all_objects.order_by("-created_at").first()
        seq = 1
        if last and last.lead_id:
            digits = "".join(ch for ch in last.lead_id if ch.isdigit())
            if digits:
                seq = int(digits) + 1
        return f"{seq:06d}"

    @staticmethod
    def get_relationship_managers():
        user_ids = UserRole.objects.filter(
            role__slug__in=RELATIONSHIP_MANAGER_SLUGS,
            role__is_active=True,
        ).values_list("user_id", flat=True)
        from apps.accounts.models import User

        return User.objects.filter(id__in=list(user_ids), is_active=True)

    @classmethod
    def auto_assign_rm(cls):
        managers = cls.get_relationship_managers()
        active_filter = ~models.Q(rm_leads__status__in=TERMINAL_LEAD_STATUSES) & models.Q(
            rm_leads__is_deleted=False
        )
        managers = managers.annotate(
            active_lead_count=models.Count("rm_leads", filter=active_filter)
        ).order_by("active_lead_count", "created_at")
        return managers.first()

    @staticmethod
    def get_credit_managers():
        user_ids = UserRole.objects.filter(
            role__slug__in=CREDIT_MANAGER_SLUGS,
            role__is_active=True,
        ).values_list("user_id", flat=True)
        from apps.accounts.models import User

        return User.objects.filter(id__in=list(user_ids), is_active=True)

    @staticmethod
    def get_field_investigators():
        user_ids = UserRole.objects.filter(
            role__slug__in=FIELD_INVESTIGATOR_SLUGS,
            role__is_active=True,
        ).values_list("user_id", flat=True)
        from apps.accounts.models import User

        return User.objects.filter(id__in=list(user_ids), is_active=True).order_by(
            "first_name",
            "last_name",
            "email",
        )

    @classmethod
    def field_investigator_roster(cls) -> list[dict]:
        roster = []
        for investigator in cls.get_field_investigators():
            label = investigator.get_full_name().strip() or investigator.email
            roster.append(
                {
                    "id": str(investigator.id),
                    "email": investigator.email,
                    "name": label,
                }
            )
        return roster

    @classmethod
    def auto_assign_cm(cls):
        managers = cls.get_credit_managers()
        active_filter = ~models.Q(cm_leads__status__in=TERMINAL_LEAD_STATUSES) & models.Q(
            cm_leads__is_deleted=False
        )
        managers = managers.annotate(
            active_lead_count=models.Count("cm_leads", filter=active_filter)
        ).order_by("active_lead_count", "created_at")
        return managers.first()

    @classmethod
    def check_existing_active_lead(cls, customer) -> Lead | None:
        return (
            customer.leads.filter(is_deleted=False)
            .exclude(status__in=TERMINAL_LEAD_STATUSES)
            .select_related("assigned_rm")
            .order_by("-created_at")
            .first()
        )

    @classmethod
    def recent_lead_count(cls, customer, *, hours: int = 1) -> int:
        since = timezone.now() - timedelta(hours=hours)
        return customer.leads.filter(is_deleted=False, created_at__gte=since).count()

    @classmethod
    def check_lead_creation_rate_limit(cls, customer) -> str | None:
        count = cls.recent_lead_count(customer)
        if count >= MAX_LEADS_PER_CUSTOMER_PER_HOUR:
            return (
                f"Maximum {MAX_LEADS_PER_CUSTOMER_PER_HOUR} leads per customer per hour. "
                "Please try again later."
            )
        return None

    @classmethod
    def _previous_relationship_manager(cls, customer):
        prior_lead = (
            customer.leads.filter(is_deleted=False, assigned_rm__isnull=False)
            .select_related("assigned_rm")
            .order_by("-created_at")
            .first()
        )
        if prior_lead is None:
            return None
        rm = prior_lead.assigned_rm
        if rm and rm.is_active:
            return rm
        return None

    @classmethod
    def _previous_credit_manager(cls, customer):
        prior_lead = (
            customer.leads.filter(is_deleted=False, assigned_cm__isnull=False)
            .select_related("assigned_cm")
            .order_by("-created_at")
            .first()
        )
        if prior_lead is None:
            return None
        cm = prior_lead.assigned_cm
        if cm and cm.is_active:
            return cm
        return None

    @classmethod
    @transaction.atomic
    def create_lead(cls, *, user, customer, data: dict) -> Lead:
        category = resolve_initial_lead_category(customer)

        if category == LeadCategory.RELOAN:
            rm = cls._previous_relationship_manager(customer) or cls.auto_assign_rm()
            cm = cls._previous_credit_manager(customer) or cls.auto_assign_cm()
        else:
            rm = cls.auto_assign_rm()
            cm = cls.auto_assign_cm()

        lead = Lead.objects.create(
            lead_id=cls._next_lead_id(),
            customer=customer,
            source=data.get("source"),
            interested_product=data.get("interested_product"),
            assigned_rm=rm,
            assigned_cm=cm,
            required_amount=data.get("required_amount"),
            loan_purpose=(data.get("loan_purpose") or "").strip(),
            category=category,
            status=resolve_initial_lead_status(customer),
            submitted_at=timezone.now(),
            created_by=user,
            updated_by=user,
        )

        if rm:
            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_by=user,
                old_rm=None,
                new_rm=rm,
                remarks=(
                    "Re-assigned previous RM on reloan creation"
                    if category == LeadCategory.RELOAN
                    else "Auto-assigned on lead creation"
                ),
            )
        if cm:
            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_by=user,
                old_cm=None,
                new_cm=cm,
                remarks=(
                    "Re-assigned previous CM on reloan creation"
                    if category == LeadCategory.RELOAN
                    else "Auto-assigned on lead creation"
                ),
            )

        record_lead_status_created(lead=lead, user=user)

        ActivityService.log(
            actor=user,
            verb="created",
            description="Lead Created",
            target=lead,
            metadata={
                "category": category,
                "assigned_rm": str(rm.id) if rm else None,
                "assigned_cm": str(cm.id) if cm else None,
            },
        )
        return lead

    @classmethod
    def _sync_application_rm(cls, *, user, lead: Lead, new_rm) -> None:
        from apps.applications.models import LoanApplication

        for application in LoanApplication.objects.filter(lead=lead, is_deleted=False):
            if application.assigned_rm_id == new_rm.id:
                continue
            application.assigned_rm = new_rm
            application.updated_by = user
            application.save(update_fields=["assigned_rm", "updated_by", "updated_at"])

    @classmethod
    @transaction.atomic
    def transfer_lead(cls, *, user, lead: Lead, new_rm, remarks: str = "") -> Lead:
        """Reassign RM only — lead category (Fresh/Reloan) and pipeline status stay unchanged."""
        if new_rm is None:
            raise LeadServiceError("A target relationship manager is required.")
        old_rm = lead.assigned_rm
        if old_rm and old_rm.id == new_rm.id:
            raise LeadServiceError("Lead is already assigned to this relationship manager.")

        original_category = lead.category
        original_status = lead.status

        lead.assigned_rm = new_rm
        lead.updated_by = user
        lead.save(update_fields=["assigned_rm", "updated_by", "updated_at"])

        cls._sync_application_rm(user=user, lead=lead, new_rm=new_rm)

        LeadAssignmentHistory.objects.create(
            lead=lead,
            assigned_by=user,
            old_rm=old_rm,
            new_rm=new_rm,
            remarks=remarks or "Lead transferred",
        )
        ActivityService.log(
            actor=user,
            verb="transferred",
            description="Lead Transferred",
            target=lead,
            metadata={
                "old_rm": str(old_rm.id) if old_rm else None,
                "new_rm": str(new_rm.id),
                "category": original_category,
                "status": original_status,
            },
        )
        UserActivityService.log(
            user=user,
            action=UserActivityAction.ASSIGN,
            description=(f"Assigned lead {lead.lead_id} to {getattr(new_rm, 'email', new_rm)}"),
            metadata={
                "lead_id": str(lead.pk),
                "old_rm": str(old_rm.id) if old_rm else None,
                "new_rm": str(new_rm.id),
            },
        )
        return lead

    @classmethod
    @transaction.atomic
    def update_lead(cls, *, user, lead: Lead, data: dict) -> Lead:
        previous_status = lead.status
        status_remarks = data.pop("status_change_remarks", "")
        new_status = data.pop("status", None)

        for key, value in data.items():
            setattr(lead, key, value)

        if new_status is not None and str(new_status) != previous_status:
            change_lead_status(
                lead=lead,
                new_status=new_status,
                user=user,
                remarks=status_remarks,
                extra_update_fields=list(data.keys()) if data else None,
            )
        elif data:
            lead.updated_by = user
            lead.save()

        if (
            lead.status in LeadConversionService.LEAD_TO_APPLICATION_STATUS
            and lead.status != previous_status
        ):
            try:
                LeadConversionService.ensure_application_for_lead(user=user, lead=lead)
            except Exception:
                logger.exception(
                    "Auto loan application sync failed for lead %s on status %s",
                    lead.lead_id,
                    lead.status,
                )
        ActivityService.log(
            actor=user,
            verb="updated",
            description="Lead Updated",
            target=lead,
            metadata={"fields": list(data.keys())},
        )
        return lead

    @classmethod
    @transaction.atomic
    def delete_lead(cls, *, user, lead: Lead) -> None:
        ActivityService.log(
            actor=user,
            verb="deleted",
            description="Lead Deleted",
            target=lead,
        )
        lead.delete(user=user)

    @staticmethod
    def visible_leads_for(user):
        from apps.accounts.services.role_helpers import (
            is_account_finance,
            is_admin_user,
            is_collection_officer,
            is_credit_manager,
            is_relationship_manager,
            is_senior_credit_manager,
            is_senior_relationship_manager,
        )
        from apps.applications.constants import FINANCE_VISIBLE_STATUSES
        from apps.leads.selectors.lead_selectors import lead_list_queryset
        from apps.loans.selectors.loan_selectors import disbursed_loan_exists_filter

        qs = lead_list_queryset()
        if is_super_admin(user) or is_admin_user(user):
            return qs.order_by("-created_at")

        if is_collection_officer(user):
            return (
                qs.filter(
                    disbursed_loan_exists_filter(prefix="applications__loan__"),
                    applications__is_deleted=False,
                )
                .distinct()
                .order_by("-created_at")
            )

        if is_account_finance(user):
            # Application status queue (approved → closed) plus any lead with a
            # disbursed loan — matches Disbursal "Disbursed" rows even when the
            # active converted_application points at a later file.
            return (
                qs.filter(
                    models.Q(
                        applications__status__in=FINANCE_VISIBLE_STATUSES,
                        applications__is_deleted=False,
                    )
                    | models.Q(
                        converted_application__status__in=FINANCE_VISIBLE_STATUSES,
                        converted_application__is_deleted=False,
                    )
                    | models.Q(
                        disbursed_loan_exists_filter(prefix="applications__loan__"),
                        applications__is_deleted=False,
                    )
                )
                .distinct()
                .order_by("-created_at")
            )

        visibility = models.Q(created_by=user)

        if is_senior_relationship_manager(user):
            visibility |= models.Q(assigned_rm__isnull=False)
        elif is_relationship_manager(user):
            visibility |= models.Q(assigned_rm=user)

        if is_senior_credit_manager(user):
            visibility |= models.Q(assigned_cm__isnull=False)
        elif is_credit_manager(user):
            visibility |= models.Q(assigned_cm=user)

        return qs.filter(visibility).order_by("-created_at")
