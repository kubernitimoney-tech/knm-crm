import pytest
from rest_framework.test import APIRequestFactory, force_authenticate
from tests.factories import (
    UserFactory,
    application_factory,
    customer_factory,
    loan_product_factory,
    salary_bank_entries,
)

from apps.accounts.models import Role, UserRole
from apps.accounts.services.permission_cache import resolve_user_permissions
from apps.applications.models import ApplicationDecision, ApplicationStatus, LoanApplication
from apps.applications.views.application_views import LoanApplicationViewSet
from apps.leads.models import Lead, LeadSource, LeadStatus
from apps.loans.services.loan_service import LoanService


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, cm) -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_cm=cm,
        status=LeadStatus.LOAN_RUNNING,
    )


def _create_application_for_lead(
    *, user, lead, status=ApplicationStatus.DOCUMENTS_VERIFIED
) -> LoanApplication:
    application = application_factory(customer=lead.customer, product=loan_product_factory())
    application.lead = lead
    application.assigned_cm = lead.assigned_cm
    application.status = status
    application.save(update_fields=["lead", "assigned_cm", "status", "updated_at"])
    lead.converted_application = application
    lead.save(update_fields=["converted_application", "updated_at"])
    return application


def _sanction_payload(*, approved_amount: str = "50000") -> dict:
    return {
        "decision": "approved",
        "approved_amount": approved_amount,
        "sanction_details": {
            "cibil_score": "750",
            "branch": "Mumbai",
            "monthly_income": "60000",
            "monthly_obligation": "0",
            "salary_banks": salary_bank_entries(),
        },
    }


@pytest.mark.django_db
class TestCmSanctionPermissions:
    def test_credit_manager_can_fetch_application_loan_without_global_loan_list(self):
        cm = UserFactory()
        _assign_role(cm, "credit-manager")
        perms = resolve_user_permissions(cm)
        assert "application.sanction" in perms
        assert "loan.view" in perms

        admin = UserFactory(email="sanction-admin@test.com")
        lead = _create_lead(lead_code="SANCT-001", cm=cm)
        app = _create_application_for_lead(
            user=admin,
            lead=lead,
            status=ApplicationStatus.APPROVED,
        )
        LoanService.create_from_application(user=admin, application=app)

        factory = APIRequestFactory()
        view = LoanApplicationViewSet.as_view({"get": "loan"})
        request = factory.get(f"/applications/applications/{app.id}/loan/")
        force_authenticate(request, user=cm)
        response = view(request, pk=str(app.id))
        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["data"]["id"] == str(app.loan.id)

    def test_credit_manager_can_create_loan_after_sanction(self):
        cm = UserFactory()
        _assign_role(cm, "credit-manager")

        admin = UserFactory(email="sanction-decide@test.com")
        lead = _create_lead(lead_code="SANCT-002", cm=cm)
        app = _create_application_for_lead(user=admin, lead=lead)

        factory = APIRequestFactory()
        decide_view = LoanApplicationViewSet.as_view({"post": "decide"})
        decide_request = factory.post(
            f"/applications/applications/{app.id}/decide/",
            _sanction_payload(),
            format="json",
        )
        force_authenticate(decide_request, user=cm)
        decide_response = decide_view(decide_request, pk=str(app.id))
        assert decide_response.status_code == 200

        loan_view = LoanApplicationViewSet.as_view({"get": "loan"})
        loan_request = factory.get(f"/applications/applications/{app.id}/loan/")
        force_authenticate(loan_request, user=cm)
        loan_response = loan_view(loan_request, pk=str(app.id))
        if loan_response.status_code == 404:
            create_view = LoanApplicationViewSet.as_view({"post": "create_loan"})
            create_request = factory.post(f"/applications/applications/{app.id}/create-loan/")
            force_authenticate(create_request, user=cm)
            create_response = create_view(create_request, pk=str(app.id))
            assert create_response.status_code in (200, 201)
            loan_response = loan_view(loan_request, pk=str(app.id))
        assert loan_response.status_code == 200

    def test_credit_manager_cannot_update_existing_sanction_without_update_permission(self):
        cm = UserFactory()
        _assign_role(cm, "credit-manager")

        admin = UserFactory(email="sanction-block@test.com")
        lead = _create_lead(lead_code="SANCT-003", cm=cm)
        app = _create_application_for_lead(
            user=admin,
            lead=lead,
            status=ApplicationStatus.APPROVED,
        )
        ApplicationDecision.objects.create(
            application=app,
            decision="approved",
            decided_by=cm,
            sanction_details={"cibil_score": "750", "branch": "Mumbai"},
            created_by=cm,
            updated_by=cm,
        )

        factory = APIRequestFactory()
        view = LoanApplicationViewSet.as_view({"post": "decide"})
        request = factory.post(
            f"/applications/applications/{app.id}/decide/",
            _sanction_payload(),
            format="json",
        )
        force_authenticate(request, user=cm)
        response = view(request, pk=str(app.id))
        assert response.status_code == 400
        assert "permission" in response.data["message"].lower()

    def test_credit_manager_can_update_existing_sanction_with_update_permission(self):
        from apps.accounts.models import Permission, UserPermission

        cm = UserFactory()
        _assign_role(cm, "credit-manager")
        update_perm = Permission.objects.get(code="application.update")
        UserPermission.objects.create(user=cm, permission=update_perm, is_active=True)

        admin = UserFactory(email="sanction-update@test.com")
        lead = _create_lead(lead_code="SANCT-004", cm=cm)
        app = _create_application_for_lead(
            user=admin,
            lead=lead,
            status=ApplicationStatus.APPROVED,
        )
        ApplicationDecision.objects.create(
            application=app,
            decision="approved",
            decided_by=cm,
            sanction_details={"cibil_score": "750", "branch": "Mumbai"},
            created_by=cm,
            updated_by=cm,
        )

        factory = APIRequestFactory()
        view = LoanApplicationViewSet.as_view({"post": "decide"})
        request = factory.post(
            f"/applications/applications/{app.id}/decide/",
            _sanction_payload(),
            format="json",
        )
        force_authenticate(request, user=cm)
        response = view(request, pk=str(app.id))
        assert response.status_code == 200
