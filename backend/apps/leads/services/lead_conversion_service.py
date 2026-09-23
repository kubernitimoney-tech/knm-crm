from datetime import date, datetime
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from apps.applications.models import ApplicationStatus, LoanApplication
from apps.applications.services.application_status_service import (
    change_application_status,
    ensure_application_submitted_at,
    record_application_status_created,
)
from apps.applications.services.snapshot_service import (
    build_customer_snapshot,
    build_product_snapshot,
)
from apps.core.verification import EntryVerificationStatus
from apps.customers.models import Customer
from apps.documents.models import Document
from apps.leads.models import Lead, LeadStatus
from apps.products.models import LoanProduct
from apps.products.services.workflow_resolver import (
    initial_workflow_state,
    resolve_default_workflow,
)


class LeadConversionError(Exception):
    pass


class LeadConversionService:
    @staticmethod
    def _json_safe(value):
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, datetime | date):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: LeadConversionService._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [LeadConversionService._json_safe(item) for item in value]
        return value

    @staticmethod
    def _next_application_number() -> str:
        from apps.applications.services.application_service import ApplicationService

        return ApplicationService._next_application_number()

    @staticmethod
    def _build_customer_snapshot(customer: Customer) -> dict:
        return build_customer_snapshot(customer)

    @staticmethod
    def _build_product_snapshot(product: LoanProduct, *, tenure_value: int) -> dict:
        return build_product_snapshot(product, tenure_value=tenure_value)

    LEAD_TO_APPLICATION_STATUS = {
        LeadStatus.INTERESTED: ApplicationStatus.INTERESTED,
        LeadStatus.DOCUMENTS_PENDING: ApplicationStatus.DOCUMENTS_INCOMPLETE,
        LeadStatus.DOCUMENTS_RECEIVED: ApplicationStatus.DOCUMENTS_RECEIVED,
    }

    APPLICATION_STATUSES_OPEN_FOR_DOC_VERIFY = frozenset(
        {
            ApplicationStatus.INTERESTED,
            ApplicationStatus.DOCUMENTS_RECEIVED,
            ApplicationStatus.DOCUMENTS_INCOMPLETE,
        }
    )
    APPLICATION_STATUSES_SKIP_DOC_SYNC = frozenset(
        {
            ApplicationStatus.APPROVED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.DISBURSAL_SHEET_SENT,
            ApplicationStatus.DISBURSED,
            ApplicationStatus.CANCELLED,
        }
    )
    APPLICATION_STATUSES_PROTECTED_FROM_DOWNGRADE = frozenset(
        {
            ApplicationStatus.DOCUMENTS_VERIFIED,
            ApplicationStatus.APPROVED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.DISBURSAL_SHEET_SENT,
            ApplicationStatus.DISBURSED,
            ApplicationStatus.CANCELLED,
        }
    )

    APPLICATION_STATUSES_REOPENABLE = frozenset(
        {
            ApplicationStatus.REJECTED,
            ApplicationStatus.CANCELLED,
        }
    )

    @classmethod
    def _prefetched_applications(cls, lead: Lead) -> list[LoanApplication] | None:
        """Return prefetched applications when the queryset used lead_list_prefetches()."""
        prefetched = getattr(lead, "_prefetched_objects_cache", {}).get("applications")
        if prefetched is not None:
            return list(prefetched)
        return None

    @classmethod
    def _get_linked_application(cls, lead: Lead) -> LoanApplication | None:
        if lead.converted_application_id:
            return lead.converted_application
        applications = cls._prefetched_applications(lead)
        if applications is not None:
            return applications[0] if applications else None
        return (
            LoanApplication.objects.filter(lead=lead, is_deleted=False)
            .order_by("-created_at")
            .first()
        )

    @classmethod
    def resolve_pipeline_application(cls, lead: Lead) -> LoanApplication | None:
        """Prefer the disbursed application for pipeline status display when present."""
        application = cls._get_linked_application(lead)
        if application is None:
            return None
        if application.status == ApplicationStatus.DISBURSED:
            return application
        applications = cls._prefetched_applications(lead)
        if applications is not None:
            for item in applications:
                if item.status == ApplicationStatus.DISBURSED:
                    return item
            return application
        disbursed = (
            LoanApplication.objects.filter(
                lead=lead,
                is_deleted=False,
                status=ApplicationStatus.DISBURSED,
            )
            .order_by("-updated_at")
            .first()
        )
        return disbursed or application

    @classmethod
    def _resolve_product(cls, lead: Lead) -> LoanProduct | None:
        if lead.interested_product and lead.interested_product.is_active:
            return lead.interested_product
        product = (
            LoanProduct.objects.filter(is_active=True, product_code__in=["PAYDAY", "PD"])
            .order_by("product_code")
            .first()
        )
        if product:
            return product
        return LoanProduct.objects.filter(is_active=True).order_by("created_at").first()

    @classmethod
    def _create_application(
        cls,
        *,
        user,
        lead: Lead,
        product: LoanProduct,
        requested_amount: Decimal,
        application_status: str,
        tenure_value: int | None = None,
        link_lead: bool = True,
    ) -> LoanApplication:
        tenure = tenure_value or product.min_tenure
        workflow = resolve_default_workflow()
        initial_state = initial_workflow_state(workflow)

        application = LoanApplication.objects.create(
            application_number=cls._next_application_number(),
            customer=lead.customer,
            lead=lead,
            product=product,
            requested_amount=requested_amount,
            tenure_value=tenure,
            tenure_unit=product.tenure_unit,
            status=application_status,
            workflow=workflow,
            current_state=initial_state,
            assigned_rm=lead.assigned_rm,
            assigned_cm=lead.assigned_cm,
            customer_snapshot=cls._build_customer_snapshot(lead.customer),
            product_snapshot=cls._build_product_snapshot(product, tenure_value=tenure),
            created_by=user,
            updated_by=user,
        )

        if link_lead:
            lead.converted_at = timezone.now()
            lead.converted_application = application
            lead.interested_product = product
            lead.updated_by = user
            lead.save(
                update_fields=[
                    "converted_at",
                    "converted_application",
                    "interested_product",
                    "updated_by",
                    "updated_at",
                ]
            )
        record_application_status_created(application=application, user=user)
        return application

    @classmethod
    @transaction.atomic
    def ensure_application_for_lead(cls, *, user, lead: Lead) -> LoanApplication | None:
        application_status = cls.LEAD_TO_APPLICATION_STATUS.get(lead.status)
        if application_status is None:
            return None

        existing = cls._get_linked_application(lead)
        if existing is not None:
            updated_fields: list[str] = []
            if existing.status in cls.APPLICATION_STATUSES_REOPENABLE:
                if existing.status != application_status:
                    change_application_status(
                        application=existing,
                        new_status=application_status,
                        user=user,
                        remarks="Reopened from rejection — synced from lead status",
                    )
            elif existing.status not in cls.APPLICATION_STATUSES_PROTECTED_FROM_DOWNGRADE:
                if existing.status != application_status:
                    change_application_status(
                        application=existing,
                        new_status=application_status,
                        user=user,
                        remarks="Synced from lead status",
                    )

            # Ensure CM/RM assignment is carried over for object-level access control.
            # Without this, a CM can have `application.approve` but still be blocked by `check_user_access`.
            if lead.assigned_cm_id and existing.assigned_cm_id != lead.assigned_cm_id:
                existing.assigned_cm_id = lead.assigned_cm_id
                updated_fields.append("assigned_cm")
            if lead.assigned_rm_id and existing.assigned_rm_id != lead.assigned_rm_id:
                existing.assigned_rm_id = lead.assigned_rm_id
                updated_fields.append("assigned_rm")
            if updated_fields:
                existing.updated_by = user
                if "updated_by" not in updated_fields:
                    updated_fields.append("updated_by")
                if "updated_at" not in updated_fields:
                    updated_fields.append("updated_at")
                existing.save(update_fields=sorted(set(updated_fields)))
            if not lead.converted_application_id:
                lead.converted_application = existing
                lead.converted_at = lead.converted_at or timezone.now()
                lead.updated_by = user
                lead.save(
                    update_fields=[
                        "converted_application",
                        "converted_at",
                        "updated_by",
                        "updated_at",
                    ]
                )
            return existing

        product = cls._resolve_product(lead)
        if product is None:
            return None

        amount = lead.required_amount or product.min_amount
        if not amount or amount <= 0:
            return None

        return cls._create_application(
            user=user,
            lead=lead,
            product=product,
            requested_amount=amount,
            application_status=application_status,
        )

    @classmethod
    @transaction.atomic
    def ensure_application_on_documents_received(
        cls, *, user, lead: Lead
    ) -> LoanApplication | None:
        return cls.ensure_application_for_lead(user=user, lead=lead)

    @classmethod
    @transaction.atomic
    def sync_application_on_document_verified(cls, *, user, lead: Lead) -> LoanApplication | None:
        application = cls._get_linked_application(lead)
        if application is None:
            return None
        if application.status not in cls.APPLICATION_STATUSES_OPEN_FOR_DOC_VERIFY:
            return application

        submitted_updated = ensure_application_submitted_at(application)
        change_application_status(
            application=application,
            new_status=ApplicationStatus.DOCUMENTS_VERIFIED,
            user=user,
            remarks="Documents verified",
            extra_update_fields=["submitted_at"] if submitted_updated else None,
        )
        return application

    @classmethod
    def _customer_documents(cls, customer: Customer):
        content_type = ContentType.objects.get_for_model(Customer)
        return Document.objects.filter(content_type=content_type, object_id=customer.pk)

    @classmethod
    @transaction.atomic
    def sync_application_from_customer_documents(
        cls, *, user, lead: Lead
    ) -> LoanApplication | None:
        application = cls._get_linked_application(lead)
        if application is None:
            return None
        if application.status in cls.APPLICATION_STATUSES_SKIP_DOC_SYNC:
            return application

        customer = lead.customer
        if customer is None:
            return application

        documents = cls._customer_documents(customer)
        if not documents.exists():
            target_status = ApplicationStatus.INTERESTED
        elif documents.exclude(verification_status=EntryVerificationStatus.VERIFIED).exists():
            target_status = ApplicationStatus.DOCUMENTS_INCOMPLETE
        else:
            return cls.sync_application_on_document_verified(user=user, lead=lead)

        if application.status == target_status:
            return application

        change_application_status(
            application=application,
            new_status=target_status,
            user=user,
            remarks=(
                "Documents incomplete"
                if target_status == ApplicationStatus.DOCUMENTS_INCOMPLETE
                else "Awaiting documents"
            ),
        )
        return application

    @classmethod
    @transaction.atomic
    def sync_application_on_sanction_approved(
        cls,
        *,
        user,
        application: LoanApplication,
    ) -> LoanApplication:
        if application.status != ApplicationStatus.APPROVED:
            change_application_status(
                application=application,
                new_status=ApplicationStatus.APPROVED,
                user=user,
                remarks="Sanction approved",
            )

        return application

    @classmethod
    @transaction.atomic
    def convert_lead(
        cls,
        *,
        user,
        lead: Lead,
        product: LoanProduct,
        requested_amount: Decimal | None = None,
        tenure_value: int | None = None,
    ) -> LoanApplication:
        if lead.status == LeadStatus.LOAN_RUNNING:
            raise LeadConversionError("Lead already has a running loan.")
        if lead.converted_application_id:
            raise LeadConversionError("Lead is already converted.")
        if not product.is_active:
            raise LeadConversionError("Selected product is not active.")

        amount = requested_amount or lead.required_amount
        if not amount or amount <= 0:
            raise LeadConversionError("A valid requested amount is required.")

        application_status = cls.LEAD_TO_APPLICATION_STATUS.get(
            lead.status,
            ApplicationStatus.INTERESTED,
        )

        application = cls._create_application(
            user=user,
            lead=lead,
            product=product,
            requested_amount=amount,
            application_status=application_status,
            tenure_value=tenure_value,
            link_lead=True,
        )
        return application
