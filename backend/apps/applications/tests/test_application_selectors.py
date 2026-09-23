import pytest
from django.core.management import call_command
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.applications.models import ApplicationStatus, LoanApplication
from apps.applications.selectors.application_selectors import applications_for_pipeline_stage
from apps.applications.services.application_service import ApplicationService
from apps.leads.models import Lead, LeadSource


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, rm, cm, customer=None) -> Lead:
    customer = customer or customer_factory()
    source, _ = LeadSource.objects.get_or_create(
        slug="web",
        defaults={"name": "Web"},
    )
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_rm=rm,
        assigned_cm=cm,
    )


def _create_approved_application(*, user, lead, rm, cm) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.APPROVED
    application.save(update_fields=["lead", "status"])
    return application


def _create_pending_application(*, user, lead, rm, cm) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.INTERESTED
    application.save(update_fields=["lead", "status"])
    return application


@pytest.mark.django_db
class TestSanctionApprovedPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_rm_and_cm_only_see_assigned_lead_applications(self):
        rm2 = UserFactory(email="rm2@test.com")
        cm3 = UserFactory(email="cm3@test.com")
        rm3 = UserFactory(email="rm3@test.com")
        cm2 = UserFactory(email="cm2@test.com")
        outsider = UserFactory(email="outsider@test.com")

        for user, slug in (
            (rm2, "relationship-manager"),
            (cm3, "credit-manager"),
            (rm3, "relationship-manager"),
            (cm2, "credit-manager"),
        ):
            _assign_role(user, slug)

        admin = UserFactory(email="admin@test.com")
        _assign_role(admin, "admin")

        creator = UserFactory(email="creator@test.com")
        lead_one = _create_lead(lead_code="LD0001", rm=rm2, cm=cm3)
        lead_two = _create_lead(lead_code="LD0002", rm=rm3, cm=cm2)

        app_one = _create_approved_application(user=creator, lead=lead_one, rm=rm2, cm=cm3)
        app_two = _create_approved_application(user=creator, lead=lead_two, rm=rm3, cm=cm2)

        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="sanction-approved"))
        cm3_rows = list(applications_for_pipeline_stage(user=cm3, stage="sanction-approved"))
        rm3_rows = list(applications_for_pipeline_stage(user=rm3, stage="sanction-approved"))
        cm2_rows = list(applications_for_pipeline_stage(user=cm2, stage="sanction-approved"))
        outsider_rows = list(
            applications_for_pipeline_stage(user=outsider, stage="sanction-approved")
        )
        admin_rows = list(applications_for_pipeline_stage(user=admin, stage="sanction-approved"))

        assert {row.id for row in rm2_rows} == {app_one.id}
        assert {row.id for row in cm3_rows} == {app_one.id}
        assert {row.id for row in rm3_rows} == {app_two.id}
        assert {row.id for row in cm2_rows} == {app_two.id}
        assert outsider_rows == []
        assert {row.id for row in admin_rows} == {app_one.id, app_two.id}

    def test_super_admin_sees_all_approved_applications(self):
        super_admin = UserFactory(is_superuser=True)
        rm = UserFactory(email="rm@test.com")
        cm = UserFactory(email="cm@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0003", rm=rm, cm=cm)
        app = _create_approved_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=super_admin, stage="sanction-approved"))
        assert {row.id for row in rows} == {app.id}

    def test_creator_without_assignment_cannot_view_approved_application(self):
        rm = UserFactory(email="assigned-rm@test.com")
        cm = UserFactory(email="assigned-cm@test.com")
        creator = UserFactory(email="creator-only@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0004", rm=rm, cm=cm)
        _create_approved_application(user=creator, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=creator, stage="sanction-approved"))
        assert rows == []

    def test_pipeline_stage_filters_to_approved_status_only(self):
        rm = UserFactory(email="rm-status@test.com")
        cm = UserFactory(email="cm-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0005", rm=rm, cm=cm)
        approved = _create_approved_application(user=rm, lead=lead, rm=rm, cm=cm)

        from apps.products.models import LoanProduct

        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        pending = ApplicationService.create_application(
            user=rm,
            customer=lead.customer,
            product=product,
            data={
                "requested_amount": 25000,
                "tenure_value": 30,
                "assigned_rm": rm,
                "assigned_cm": cm,
            },
        )
        pending.lead = lead
        pending.status = ApplicationStatus.INTERESTED
        pending.save(update_fields=["lead", "status"])

        approved_rows = list(applications_for_pipeline_stage(user=rm, stage="sanction-approved"))
        pending_rows = list(applications_for_pipeline_stage(user=rm, stage="sanction-pending"))

        assert {row.id for row in approved_rows} == {approved.id}
        assert {row.id for row in pending_rows} == {pending.id}


@pytest.mark.django_db
class TestSanctionPendingPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_rm_sees_only_their_documents_pending_applications(self):
        rm2 = UserFactory(email="rm2-pending@test.com")
        rm3 = UserFactory(email="rm3-pending@test.com")
        cm3 = UserFactory(email="cm3-pending@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm3, "credit-manager")

        admin = UserFactory(email="admin-pending@test.com")
        _assign_role(admin, "admin")

        lead_one = _create_lead(lead_code="LD0101", rm=rm2, cm=cm3)
        lead_two = _create_lead(lead_code="LD0102", rm=rm3, cm=cm3)

        app_one = _create_pending_application(user=rm2, lead=lead_one, rm=rm2, cm=cm3)
        app_two = _create_pending_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="sanction-pending"))
        rm3_rows = list(applications_for_pipeline_stage(user=rm3, stage="sanction-pending"))
        cm3_rows = list(applications_for_pipeline_stage(user=cm3, stage="sanction-pending"))
        admin_rows = list(applications_for_pipeline_stage(user=admin, stage="sanction-pending"))

        assert {row.id for row in rm2_rows} == {app_one.id}
        assert {row.id for row in rm3_rows} == {app_two.id}
        assert {row.id for row in cm3_rows} == {app_one.id, app_two.id}
        assert {row.id for row in admin_rows} == {app_one.id, app_two.id}

    def test_super_admin_sees_all_documents_pending_applications(self):
        super_admin = UserFactory(is_superuser=True)
        rm = UserFactory(email="rm-pending-sa@test.com")
        cm = UserFactory(email="cm-pending-sa@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0103", rm=rm, cm=cm)
        app = _create_pending_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=super_admin, stage="sanction-pending"))
        assert {row.id for row in rows} == {app.id}

    def test_pending_stage_includes_documents_verified(self):
        rm = UserFactory(email="rm-pending-status@test.com")
        cm = UserFactory(email="cm-pending-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0104", rm=rm, cm=cm)
        pending = _create_pending_application(user=rm, lead=lead, rm=rm, cm=cm)

        verified = _create_pending_application(user=rm, lead=lead, rm=rm, cm=cm)
        verified.status = ApplicationStatus.DOCUMENTS_VERIFIED
        verified.save(update_fields=["status"])

        rows = list(applications_for_pipeline_stage(user=rm, stage="sanction-pending"))
        assert {row.id for row in rows} == {pending.id, verified.id}


def _create_rejected_application(*, user, lead, rm, cm) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.REJECTED
    application.save(update_fields=["lead", "status"])
    return application


@pytest.mark.django_db
class TestSanctionRejectedPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_rm_sees_only_their_rejected_applications(self):
        rm2 = UserFactory(email="rm2-rejected@test.com")
        rm3 = UserFactory(email="rm3-rejected@test.com")
        cm3 = UserFactory(email="cm3-rejected@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm3, "credit-manager")

        admin = UserFactory(email="admin-rejected@test.com")
        _assign_role(admin, "admin")

        lead_one = _create_lead(lead_code="LD0201", rm=rm2, cm=cm3)
        lead_two = _create_lead(lead_code="LD0202", rm=rm3, cm=cm3)

        app_one = _create_rejected_application(user=rm2, lead=lead_one, rm=rm2, cm=cm3)
        app_two = _create_rejected_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="sanction-rejected"))
        rm3_rows = list(applications_for_pipeline_stage(user=rm3, stage="sanction-rejected"))
        cm3_rows = list(applications_for_pipeline_stage(user=cm3, stage="sanction-rejected"))
        admin_rows = list(applications_for_pipeline_stage(user=admin, stage="sanction-rejected"))

        assert {row.id for row in rm2_rows} == {app_one.id}
        assert {row.id for row in rm3_rows} == {app_two.id}
        assert {row.id for row in cm3_rows} == {app_one.id, app_two.id}
        assert {row.id for row in admin_rows} == {app_one.id, app_two.id}

    def test_super_admin_sees_all_rejected_applications(self):
        super_admin = UserFactory(is_superuser=True)
        rm = UserFactory(email="rm-rejected-sa@test.com")
        cm = UserFactory(email="cm-rejected-sa@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0203", rm=rm, cm=cm)
        app = _create_rejected_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=super_admin, stage="sanction-rejected"))
        assert {row.id for row in rows} == {app.id}

    def test_rejected_stage_excludes_other_statuses(self):
        rm = UserFactory(email="rm-rejected-status@test.com")
        cm = UserFactory(email="cm-rejected-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0204", rm=rm, cm=cm)
        rejected = _create_rejected_application(user=rm, lead=lead, rm=rm, cm=cm)
        _create_approved_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=rm, stage="sanction-rejected"))
        assert {row.id for row in rows} == {rejected.id}


def _create_disbursal_sheet_application(*, user, lead, rm, cm) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.DISBURSAL_SHEET_SENT
    application.save(update_fields=["lead", "status"])
    return application


@pytest.mark.django_db
class TestDisbursalSheetPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_cm_sees_only_their_disbursal_sheet_applications(self):
        rm2 = UserFactory(email="rm2-disbursal@test.com")
        rm3 = UserFactory(email="rm3-disbursal@test.com")
        cm2 = UserFactory(email="cm2-disbursal@test.com")
        cm3 = UserFactory(email="cm3-disbursal@test.com")
        finance = UserFactory(email="finance-disbursal@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm2, "credit-manager")
        _assign_role(cm3, "credit-manager")
        _assign_role(finance, "account-finance")

        admin = UserFactory(email="admin-disbursal@test.com")
        _assign_role(admin, "admin")

        lead_one = _create_lead(lead_code="LD0301", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD0302", rm=rm3, cm=cm3)

        app_one = _create_disbursal_sheet_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        app_two = _create_disbursal_sheet_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="disbursal-sheet"))
        cm2_rows = list(applications_for_pipeline_stage(user=cm2, stage="disbursal-sheet"))
        cm3_rows = list(applications_for_pipeline_stage(user=cm3, stage="disbursal-sheet"))
        finance_rows = list(applications_for_pipeline_stage(user=finance, stage="disbursal-sheet"))
        admin_rows = list(applications_for_pipeline_stage(user=admin, stage="disbursal-sheet"))

        assert rm2_rows == []
        assert {row.id for row in cm2_rows} == {app_one.id}
        assert {row.id for row in cm3_rows} == {app_two.id}
        assert {row.id for row in finance_rows} == {app_one.id, app_two.id}
        assert {row.id for row in admin_rows} == {app_one.id, app_two.id}

    def test_super_admin_sees_all_disbursal_sheet_applications(self):
        super_admin = UserFactory(is_superuser=True)
        rm = UserFactory(email="rm-disbursal-sa@test.com")
        cm = UserFactory(email="cm-disbursal-sa@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0303", rm=rm, cm=cm)
        app = _create_disbursal_sheet_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=super_admin, stage="disbursal-sheet"))
        assert {row.id for row in rows} == {app.id}

    def test_disbursal_sheet_stage_excludes_other_statuses(self):
        rm = UserFactory(email="rm-disbursal-status@test.com")
        cm = UserFactory(email="cm-disbursal-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0304", rm=rm, cm=cm)
        sheet_sent = _create_disbursal_sheet_application(user=rm, lead=lead, rm=rm, cm=cm)
        _create_approved_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=cm, stage="disbursal-sheet"))
        assert {row.id for row in rows} == {sheet_sent.id}


def _create_disbursed_application(*, user, lead, rm, cm) -> LoanApplication:
    from apps.products.models import LoanProduct

    product = LoanProduct.objects.filter(product_code="PAYDAY").first()
    application = ApplicationService.create_application(
        user=user,
        customer=lead.customer,
        product=product,
        data={
            "requested_amount": 50000,
            "tenure_value": 30,
            "assigned_rm": rm,
            "assigned_cm": cm,
        },
    )
    application.lead = lead
    application.status = ApplicationStatus.DISBURSED
    application.save(update_fields=["lead", "status"])
    return application


@pytest.mark.django_db
class TestDisbursedPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_cm_sees_only_their_disbursed_applications(self):
        rm2 = UserFactory(email="rm2-disbursed@test.com")
        rm3 = UserFactory(email="rm3-disbursed@test.com")
        cm2 = UserFactory(email="cm2-disbursed@test.com")
        cm3 = UserFactory(email="cm3-disbursed@test.com")
        finance = UserFactory(email="finance-disbursed@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm2, "credit-manager")
        _assign_role(cm3, "credit-manager")
        _assign_role(finance, "account-finance")

        admin = UserFactory(email="admin-disbursed@test.com")
        _assign_role(admin, "admin")

        lead_one = _create_lead(lead_code="LD0401", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD0402", rm=rm3, cm=cm3)

        app_one = _create_disbursed_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        app_two = _create_disbursed_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="disbursed"))
        cm2_rows = list(applications_for_pipeline_stage(user=cm2, stage="disbursed"))
        cm3_rows = list(applications_for_pipeline_stage(user=cm3, stage="disbursed"))
        finance_rows = list(applications_for_pipeline_stage(user=finance, stage="disbursed"))
        admin_rows = list(applications_for_pipeline_stage(user=admin, stage="disbursed"))

        assert rm2_rows == []
        assert {row.id for row in cm2_rows} == {app_one.id}
        assert {row.id for row in cm3_rows} == {app_two.id}
        assert {row.id for row in finance_rows} == {app_one.id, app_two.id}
        assert {row.id for row in admin_rows} == {app_one.id, app_two.id}

    def test_super_admin_sees_all_disbursed_applications(self):
        super_admin = UserFactory(is_superuser=True)
        rm = UserFactory(email="rm-disbursed-sa@test.com")
        cm = UserFactory(email="cm-disbursed-sa@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0403", rm=rm, cm=cm)
        app = _create_disbursed_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=super_admin, stage="disbursed"))
        assert {row.id for row in rows} == {app.id}

    def test_disbursed_stage_excludes_other_statuses(self):
        rm = UserFactory(email="rm-disbursed-status@test.com")
        cm = UserFactory(email="cm-disbursed-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0404", rm=rm, cm=cm)
        disbursed = _create_disbursed_application(user=rm, lead=lead, rm=rm, cm=cm)
        _create_disbursal_sheet_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=cm, stage="disbursed"))
        assert {row.id for row in rows} == {disbursed.id}


@pytest.mark.django_db
class TestEnachPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")

    def test_finance_sees_all_approved_enach_applications(self):
        rm2 = UserFactory(email="rm2-enach@test.com")
        rm3 = UserFactory(email="rm3-enach@test.com")
        cm2 = UserFactory(email="cm2-enach@test.com")
        cm3 = UserFactory(email="cm3-enach@test.com")
        finance = UserFactory(email="finance-enach@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm2, "credit-manager")
        _assign_role(cm3, "credit-manager")
        _assign_role(finance, "account-finance")

        lead_one = _create_lead(lead_code="LD0501", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD0502", rm=rm3, cm=cm3)

        app_one = _create_approved_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        app_two = _create_approved_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        finance_rows = list(applications_for_pipeline_stage(user=finance, stage="enach"))
        cm2_rows = list(applications_for_pipeline_stage(user=cm2, stage="enach"))
        rm2_rows = list(applications_for_pipeline_stage(user=rm2, stage="enach"))

        assert {row.id for row in finance_rows} == {app_one.id, app_two.id}
        assert {row.id for row in cm2_rows} == {app_one.id}
        assert {row.id for row in rm2_rows} == {app_one.id}

    def test_enach_stage_excludes_non_approved_statuses(self):
        rm = UserFactory(email="rm-enach-status@test.com")
        cm = UserFactory(email="cm-enach-status@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")

        lead = _create_lead(lead_code="LD0503", rm=rm, cm=cm)
        approved = _create_approved_application(user=rm, lead=lead, rm=rm, cm=cm)
        _create_disbursal_sheet_application(user=rm, lead=lead, rm=rm, cm=cm)

        rows = list(applications_for_pipeline_stage(user=cm, stage="enach"))
        assert {row.id for row in rows} == {approved.id}


@pytest.mark.django_db
class TestVisibleApplicationsForCollectionOfficer:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")
        call_command("seed_products")

    def test_collection_officer_sees_disbursed_loan_applications_only(self):
        from datetime import date

        from django.utils import timezone

        from apps.applications.selectors.application_selectors import visible_applications_for
        from apps.loans.models import Loan, LoanStatus

        rm = UserFactory(email="rm-co-visible@test.com")
        cm = UserFactory(email="cm-co-visible@test.com")
        collector = UserFactory(email="collector-visible@test.com")
        _assign_role(rm, "relationship-manager")
        _assign_role(cm, "credit-manager")
        _assign_role(collector, "collection-officer")

        lead_disbursed = _create_lead(lead_code="LD0601", rm=rm, cm=cm)
        lead_pending = _create_lead(lead_code="LD0602", rm=rm, cm=cm)

        disbursed_app = _create_disbursed_application(
            user=rm,
            lead=lead_disbursed,
            rm=rm,
            cm=cm,
        )
        Loan.objects.create(
            loan_account_number="LN-CO-001",
            application=disbursed_app,
            customer=disbursed_app.customer,
            product=disbursed_app.product,
            principal_amount=disbursed_app.requested_amount,
            total_repayable=disbursed_app.requested_amount,
            due_date=date.today(),
            status=LoanStatus.ACTIVE,
            disbursed_at=timezone.now(),
        )
        pending_app = _create_pending_application(user=rm, lead=lead_pending, rm=rm, cm=cm)

        visible = list(visible_applications_for(collector))
        assert {row.id for row in visible} == {disbursed_app.id}
        assert pending_app.id not in {row.id for row in visible}


@pytest.mark.django_db
class TestSeniorCmPipelineAccess:
    @pytest.fixture(autouse=True)
    def seed(self):
        call_command("seed_permissions")
        call_command("seed_products")

    def _setup_two_cm_applications(self):
        rm2 = UserFactory(email="rm2-srcm@test.com")
        rm3 = UserFactory(email="rm3-srcm@test.com")
        cm2 = UserFactory(email="cm2-srcm@test.com")
        cm3 = UserFactory(email="cm3-srcm@test.com")
        sr_cm = UserFactory(email="srcm@test.com")
        _assign_role(rm2, "relationship-manager")
        _assign_role(rm3, "relationship-manager")
        _assign_role(cm2, "credit-manager")
        _assign_role(cm3, "credit-manager")
        _assign_role(sr_cm, "senior-credit-manager")

        lead_one = _create_lead(lead_code="LD-SRCM-01", rm=rm2, cm=cm2)
        lead_two = _create_lead(lead_code="LD-SRCM-02", rm=rm3, cm=cm3)

        return sr_cm, cm2, cm3, lead_one, lead_two, rm2, rm3

    def test_senior_cm_sees_all_sanction_pipeline_stages(self):
        sr_cm, cm2, cm3, lead_one, lead_two, rm2, rm3 = self._setup_two_cm_applications()

        pending_one = _create_pending_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        pending_two = _create_pending_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)
        approved_one = _create_approved_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        approved_two = _create_approved_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        from apps.products.models import LoanProduct

        product = LoanProduct.objects.filter(product_code="PAYDAY").first()
        rejected = ApplicationService.create_application(
            user=rm2,
            customer=lead_one.customer,
            product=product,
            data={
                "requested_amount": 50000,
                "tenure_value": 30,
                "assigned_rm": rm2,
                "assigned_cm": cm2,
            },
        )
        rejected.lead = lead_one
        rejected.status = ApplicationStatus.REJECTED
        rejected.save(update_fields=["lead", "status"])

        sr_pending = {
            row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="sanction-pending")
        }
        sr_approved = {
            row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="sanction-approved")
        }
        sr_rejected = {
            row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="sanction-rejected")
        }
        sr_enach = {row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="enach")}

        assert sr_pending == {pending_one.id, pending_two.id}
        assert sr_approved == {approved_one.id, approved_two.id}
        assert sr_rejected == {rejected.id}
        assert sr_enach == {approved_one.id, approved_two.id}

        cm2_rows = list(applications_for_pipeline_stage(user=cm2, stage="sanction-approved"))
        assert {row.id for row in cm2_rows} == {approved_one.id}

    def test_senior_cm_sees_all_disbursal_pipeline_stages(self):
        sr_cm, cm2, cm3, lead_one, lead_two, rm2, rm3 = self._setup_two_cm_applications()

        sheet_one = _create_disbursal_sheet_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        sheet_two = _create_disbursal_sheet_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)
        disbursed_one = _create_disbursed_application(user=rm2, lead=lead_one, rm=rm2, cm=cm2)
        disbursed_two = _create_disbursed_application(user=rm3, lead=lead_two, rm=rm3, cm=cm3)

        sr_sheet = {
            row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="disbursal-sheet")
        }
        sr_disbursed = {
            row.id for row in applications_for_pipeline_stage(user=sr_cm, stage="disbursed")
        }

        assert sr_sheet == {sheet_one.id, sheet_two.id}
        assert sr_disbursed == {disbursed_one.id, disbursed_two.id}
        assert {
            row.id for row in applications_for_pipeline_stage(user=cm2, stage="disbursal-sheet")
        } == {sheet_one.id}
