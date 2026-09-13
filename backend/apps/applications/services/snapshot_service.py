"""Immutable customer/product snapshots for applications and loans."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from apps.customers.models import Customer
from apps.products.models import LoanProduct


def json_safe(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def build_customer_snapshot(customer: Customer) -> dict:
    snapshot = {
        "customer_code": customer.customer_code,
        "full_name": customer.full_name,
        "email": customer.email,
        "mobile_number": customer.mobile_number,
        "dob": customer.dob.isoformat() if customer.dob else None,
        "gender": customer.gender,
        "identities": list(
            customer.identities.values("identity_type", "is_primary", "verified_at")
        ),
        "addresses": list(
            customer.addresses.values("address_type", "line1", "city", "state", "pincode")
        ),
        "employments": list(
            customer.employments.filter(is_current=True).values(
                "employer_name", "employment_type", "monthly_salary"
            )
        ),
    }
    return json_safe(snapshot)


def build_product_snapshot(
    product: LoanProduct,
    *,
    tenure_value: int | None = None,
    interest_rate: Decimal | None = None,
    processing_fee: Decimal | None = None,
    tenure_days: int | None = None,
    approved_amount: Decimal | None = None,
) -> dict:
    """Capture product terms at a point in time (application or loan booking)."""
    snapshot = {
        "product_id": str(product.id),
        "product_code": product.product_code,
        "name": product.name,
        "description": product.description,
        "interest_type": product.interest_type,
        "interest_rate": interest_rate if interest_rate is not None else product.interest_rate,
        "processing_fee_type": product.processing_fee_type,
        "processing_fee_percentage": product.processing_fee_percentage,
        "processing_fee": processing_fee if processing_fee is not None else product.processing_fee,
        "gst_percentage": product.gst_percentage,
        "penalty_rate": product.penalty_rate,
        "penalty_grace_days": product.penalty_grace_days,
        "tenure_unit": product.tenure_unit,
        "min_amount": product.min_amount,
        "max_amount": product.max_amount,
        "min_tenure": product.min_tenure,
        "max_tenure": product.max_tenure,
        "preclosure_allowed": product.preclosure_allowed,
        "part_payment_allowed": product.part_payment_allowed,
        "max_part_payments": product.max_part_payments,
        "overdue_after_days": product.overdue_after_days,
        "default_after_days": product.default_after_days,
    }
    if tenure_value is not None:
        snapshot["tenure_value"] = tenure_value
    if tenure_days is not None:
        snapshot["tenure_days"] = tenure_days
    if approved_amount is not None:
        snapshot["approved_amount"] = approved_amount
    return json_safe(snapshot)


def build_loan_product_snapshot(
    *,
    application,
    processing_fee: Decimal,
    interest_rate: Decimal,
    tenure_days: int,
    approved_amount: Decimal,
) -> dict:
    """Freeze sanctioned product terms when a loan account is created."""
    product = application.product
    snapshot = dict(application.product_snapshot or {})
    snapshot.update(
        build_product_snapshot(
            product,
            tenure_value=application.tenure_value,
            interest_rate=interest_rate,
            processing_fee=processing_fee,
            tenure_days=tenure_days,
            approved_amount=approved_amount,
        )
    )
    return json_safe(snapshot)
