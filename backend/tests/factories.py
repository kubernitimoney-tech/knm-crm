import uuid
from decimal import Decimal


def UserFactory(**kwargs):
    from apps.accounts.models import User

    email = kwargs.pop("email", f"user-{uuid.uuid4().hex[:8]}@test.com")
    password = kwargs.pop("password", "testpass123")
    defaults = {
        "first_name": "Test",
        "last_name": "User",
        "mobile_number": "9123456789",
        "is_active": True,
    }
    defaults.update(kwargs)
    return User.objects.create_user(email=email, password=password, **defaults)


def grant_permission(user, permission_code: str):
    from apps.accounts.models import Permission, UserPermission

    permission, _ = Permission.objects.get_or_create(
        code=permission_code,
        defaults={
            "module": permission_code.split(".")[0],
            "action": permission_code.split(".")[-1],
        },
    )
    UserPermission.objects.update_or_create(
        user=user,
        permission=permission,
        defaults={"is_active": True},
    )


def CustomerFactory(**kwargs):
    from apps.accounts.models import User

    user = User.objects.first() or UserFactory()
    return customer_factory(**kwargs)


def customer_factory(**kwargs):
    from apps.accounts.models import User
    from apps.customers.services.customer_service import CustomerService

    uid = uuid.uuid4().hex
    user = User.objects.first() or UserFactory()
    return CustomerService.create_customer(
        user=user,
        data={
            "first_name": kwargs.pop("first_name", "Test"),
            "last_name": kwargs.pop("last_name", "Customer"),
            "email": kwargs.pop("email", f"customer-{uid[:8]}@example.com"),
            "mobile_number": kwargs.pop(
                "mobile_number",
                f"9{int(uid, 16) % 10**9:09d}",
            ),
            "pan_no": kwargs.pop(
                "pan_no",
                f"TEST{uid[:4].upper()}{int(uid[4:8], 16) % 10000:04d}A",
            ),
            **kwargs,
        },
    )


def loan_product_factory(**kwargs):
    """Ensure the default PAYDAY product exists (mirrors seed_products)."""
    from apps.products.models import (
        InterestType,
        LoanProduct,
        ProcessingFeeType,
        TenureUnit,
    )

    product_code = kwargs.pop("product_code", "PAYDAY")
    defaults = {
        "name": kwargs.pop("name", "Payday Loan"),
        "description": kwargs.pop("description", "Short-term payday loan product."),
        "min_amount": kwargs.pop("min_amount", Decimal("5000")),
        "max_amount": kwargs.pop("max_amount", Decimal("100000")),
        "min_tenure": kwargs.pop("min_tenure", 7),
        "max_tenure": kwargs.pop("max_tenure", 40),
        "tenure_unit": kwargs.pop("tenure_unit", TenureUnit.DAYS),
        "interest_type": kwargs.pop("interest_type", InterestType.FLAT),
        "interest_rate": kwargs.pop("interest_rate", Decimal("1.00")),
        "processing_fee_type": kwargs.pop("processing_fee_type", ProcessingFeeType.PERCENTAGE),
        "processing_fee_percentage": kwargs.pop("processing_fee_percentage", Decimal("10")),
        "gst_percentage": kwargs.pop("gst_percentage", Decimal("18")),
        "overdue_after_days": kwargs.pop("overdue_after_days", 1),
        "default_after_days": kwargs.pop("default_after_days", 30),
        "is_active": kwargs.pop("is_active", True),
    }
    defaults.update(kwargs)
    product, _ = LoanProduct.objects.update_or_create(
        product_code=product_code,
        defaults=defaults,
    )
    return product


_CUSTOMER_FIELDS = frozenset({"first_name", "last_name", "email", "mobile_number", "pan_no", "pan"})


def application_factory(customer=None, **kwargs):
    from apps.accounts.models import User
    from apps.applications.services.application_service import ApplicationService

    customer_kwargs = {key: kwargs.pop(key) for key in list(kwargs) if key in _CUSTOMER_FIELDS}
    customer = customer or customer_factory(**customer_kwargs)
    product = kwargs.pop("product", None) or loan_product_factory()
    user = User.objects.first() or UserFactory()
    application_data = {
        "requested_amount": kwargs.pop("requested_amount", 10000),
        "tenure_value": kwargs.pop("tenure_value", 30),
    }
    application_data.update(kwargs)
    return ApplicationService.create_application(
        user=user,
        customer=customer,
        product=product,
        data=application_data,
    )


def salary_bank_entries(*, account_number: str = "1111222233") -> list[dict[str, str]]:
    from apps.organization.models import Bank

    bank, _ = Bank.objects.get_or_create(name="HDFC Bank", defaults={"is_active": True})
    return [
        {
            "bank_id": str(bank.id),
            "bank_name": bank.name,
            "account_number": account_number,
        }
    ]
