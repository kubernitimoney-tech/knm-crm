import pytest
from tests.factories import UserFactory

from apps.customers.services.customer_service import CustomerService


@pytest.mark.django_db
class TestCustomerService:
    def test_create_customer(self):
        user = UserFactory()
        customer = CustomerService.create_customer(
            user=user,
            data={
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@test.com",
                "mobile_number": "9999999999",
            },
        )
        assert customer.customer_code
        assert customer.created_by == user

    def test_update_customer_profile(self):
        from apps.customers.models import CustomerEmployment, EmploymentType

        user = UserFactory()
        customer = CustomerService.create_customer(
            user=user,
            data={
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@test.com",
                "mobile_number": "9999999999",
                "pan_no": "ABCDE1234F",
                "aadhaar_no": "123456789012",
            },
            employment={
                "employment_type": EmploymentType.SALARIED,
                "monthly_salary": 50000,
            },
            address={
                "line1": "123 Main St",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
            },
        )

        CustomerService.update_customer_profile(
            user=user,
            customer=customer,
            data={
                "first_name": "Janet",
                "monthly_income": 75000,
                "employment_type": EmploymentType.SELF_EMPLOYED,
                "city": "Pune",
                "pan_no": "FGHIJ5678K",
            },
        )

        customer.refresh_from_db()
        assert customer.first_name == "Janet"
        assert CustomerService.get_primary_pan(customer) == "FGHIJ5678K"

        employment = CustomerEmployment.objects.get(customer=customer, is_current=True)
        assert employment.monthly_salary == 75000
        assert employment.employment_type == EmploymentType.SELF_EMPLOYED

        address = customer.addresses.first()
        assert address.city == "Pune"

    def test_resolve_for_lead_reuses_existing_customer_without_updating_profile(self):
        from apps.customers.models import CustomerEmployment, EmploymentType

        user = UserFactory()
        existing = CustomerService.create_customer(
            user=user,
            data={
                "first_name": "Ravi",
                "last_name": "Kumar",
                "email": "ravi@example.com",
                "mobile_number": "9876543210",
                "pan_no": "ABCDE1234F",
            },
            employment={
                "employment_type": EmploymentType.SALARIED,
                "monthly_salary": 50000,
                "employer_name": "Old Corp",
            },
        )

        customer, created = CustomerService.resolve_for_lead(
            user=user,
            pan="ABCDE1234F",
            aadhaar=None,
            email="new.email@example.com",
            mobile="9999999999",
            customer_data={
                "first_name": "Different",
                "last_name": "Name",
                "email": "new.email@example.com",
                "mobile_number": "9999999999",
            },
            employment={
                "employment_type": EmploymentType.SALARIED,
                "monthly_salary": 80000,
                "employer_name": "Old Corp",
            },
            address={"city": "Delhi", "state": "Delhi", "pincode": "110001"},
        )

        assert created is False
        assert customer.id == existing.id
        customer.refresh_from_db()
        assert customer.first_name == "Ravi"
        assert customer.last_name == "Kumar"
        assert customer.email == "ravi@example.com"
        assert customer.mobile_number == "9876543210"
        assert not customer.addresses.filter(city="Delhi").exists()

        employment = CustomerEmployment.objects.get(customer=customer, is_current=True)
        assert employment.monthly_salary == 80000
        assert employment.employer_name == "Old Corp"

    def test_resolve_for_lead_creates_new_employment_when_customer_switched_job(self):
        from apps.customers.models import CustomerEmployment, EmploymentType

        user = UserFactory()
        existing = CustomerService.create_customer(
            user=user,
            data={
                "first_name": "Ravi",
                "last_name": "Kumar",
                "email": "ravi@example.com",
                "mobile_number": "9876543210",
                "pan_no": "ABCDE1234F",
            },
            employment={
                "employment_type": EmploymentType.SALARIED,
                "monthly_salary": 50000,
                "employer_name": "Old Corp",
            },
        )

        customer, created = CustomerService.resolve_for_lead(
            user=user,
            pan="ABCDE1234F",
            aadhaar=None,
            email="ravi@example.com",
            mobile="9876543210",
            customer_data={
                "first_name": "Ravi",
                "last_name": "Kumar",
                "email": "ravi@example.com",
                "mobile_number": "9876543210",
            },
            employment={
                "employment_type": EmploymentType.SALARIED,
                "monthly_salary": 90000,
                "employer_name": "New Corp",
                "designation": "Manager",
            },
        )

        assert created is False
        assert customer.id == existing.id
        current = CustomerEmployment.objects.get(customer=customer, is_current=True)
        assert current.employer_name == "New Corp"
        assert current.monthly_salary == 90000
        assert current.designation == "Manager"
        assert CustomerEmployment.objects.filter(customer=customer, is_current=False).count() == 1

    def test_resolve_for_lead_creates_customer_when_no_identifier_matches(self):
        user = UserFactory()
        customer, created = CustomerService.resolve_for_lead(
            user=user,
            pan="ZZZZZ9999Z",
            aadhaar=None,
            email="fresh@example.com",
            mobile="8888888888",
            customer_data={
                "first_name": "Fresh",
                "last_name": "Lead",
                "email": "fresh@example.com",
                "mobile_number": "8888888888",
            },
        )

        assert created is True
        assert customer.first_name == "Fresh"
        assert customer.email == "fresh@example.com"
