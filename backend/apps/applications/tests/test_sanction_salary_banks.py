import pytest
from tests.factories import UserFactory, application_factory

from apps.applications.models import ApplicationDecision, SanctionSalaryBank
from apps.applications.services.application_service import ApplicationService
from apps.organization.models import Bank


@pytest.mark.django_db
def test_decide_persists_multiple_salary_banks():
    user = UserFactory()
    application = application_factory()
    sbi = Bank.objects.create(name="State Bank of India")
    hdfc = Bank.objects.create(name="HDFC Bank")

    ApplicationService._advance_to_documents_verified(user=user, application=application)
    ApplicationService.decide(
        user=user,
        application=application,
        decision="approved",
        approved_amount=application.requested_amount,
        approved_tenure_value=30,
        interest_rate="1.00",
        sanction_details={
            "monthly_income": "50000",
            "cibil_score": "750",
            "salary_banks": [
                {"bank_id": str(sbi.id), "bank_name": sbi.name, "account_number": "1111222233"},
                {"bank_id": str(hdfc.id), "bank_name": hdfc.name, "account_number": "4444555566"},
            ],
        },
    )

    decision = ApplicationDecision.objects.filter(application=application).latest("decided_at")
    links = SanctionSalaryBank.objects.filter(decision=decision).order_by("created_at")
    assert links.count() == 2
    assert decision.sanction_details["bank_name"] == "State Bank of India, HDFC Bank"
    assert decision.sanction_details["salary_account"] == "1111222233"


@pytest.mark.django_db
def test_decide_rejects_duplicate_salary_bank():
    user = UserFactory()
    application = application_factory()
    sbi = Bank.objects.create(name="State Bank of India")

    ApplicationService._advance_to_documents_verified(user=user, application=application)
    with pytest.raises(Exception, match="Duplicate salary banks"):
        ApplicationService.decide(
            user=user,
            application=application,
            decision="approved",
            approved_amount=application.requested_amount,
            approved_tenure_value=30,
            interest_rate="1.00",
            sanction_details={
                "monthly_income": "50000",
                "cibil_score": "750",
                "salary_banks": [
                    {"bank_id": str(sbi.id), "bank_name": sbi.name},
                    {"bank_id": str(sbi.id), "bank_name": sbi.name},
                ],
            },
        )
