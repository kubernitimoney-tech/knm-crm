from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from tests.factories import UserFactory, customer_factory

from apps.accounts.models import Role, UserRole
from apps.leads.models import Lead, LeadSource
from apps.products.models import LoanProduct


def _assign_role(user, slug: str) -> None:
    role = Role.objects.get(slug=slug)
    UserRole.objects.create(user=user, role=role)


def _create_lead(*, lead_code: str, cm=None, product=None) -> Lead:
    customer = customer_factory()
    source, _ = LeadSource.objects.get_or_create(slug="web", defaults={"name": "Web"})
    return Lead.objects.create(
        lead_id=lead_code,
        customer=customer,
        source=source,
        assigned_cm=cm,
        interested_product=product,
        required_amount=Decimal("50000"),
    )


def _convert(client, user, lead, product_id):
    client.force_authenticate(user=user)
    return client.post(
        reverse("lead-convert", kwargs={"pk": lead.id}),
        {"product_id": str(product_id), "requested_amount": "50000"},
        format="json",
    )


@pytest.mark.django_db
def test_credit_manager_cannot_switch_product_on_convert():
    payday = LoanProduct.objects.get(product_code="PAYDAY")
    other = LoanProduct.objects.get(product_code="SALARY_ADVANCE")
    cm = UserFactory(email="cm-product-lock@test.com")
    _assign_role(cm, "credit-manager")
    lead = _create_lead(lead_code="CVT-CM-001", cm=cm, product=payday)

    response = _convert(APIClient(), cm, lead, other.id)

    assert response.status_code == status.HTTP_201_CREATED
    assert str(response.data["data"]["application"]["product"]) == str(payday.id)


@pytest.mark.django_db
def test_admin_cannot_switch_product_on_convert():
    payday = LoanProduct.objects.get(product_code="PAYDAY")
    other = LoanProduct.objects.get(product_code="SALARY_ADVANCE")
    admin = UserFactory(email="admin-product-lock@test.com")
    _assign_role(admin, "admin")
    lead = _create_lead(lead_code="CVT-AD-001", product=payday)

    response = _convert(APIClient(), admin, lead, other.id)

    assert response.status_code == status.HTTP_201_CREATED
    assert str(response.data["data"]["application"]["product"]) == str(payday.id)


@pytest.mark.django_db
def test_production_manager_can_switch_product_on_convert():
    payday = LoanProduct.objects.get(product_code="PAYDAY")
    other = LoanProduct.objects.get(product_code="SALARY_ADVANCE")
    manager = UserFactory(email="pm-product-lock@test.com")
    _assign_role(manager, "production-manager")
    lead = _create_lead(lead_code="CVT-PM-001", product=payday)

    response = _convert(APIClient(), manager, lead, other.id)

    assert response.status_code == status.HTTP_201_CREATED
    assert str(response.data["data"]["application"]["product"]) == str(other.id)


@pytest.mark.django_db
def test_super_admin_can_switch_product_on_convert():
    payday = LoanProduct.objects.get(product_code="PAYDAY")
    other = LoanProduct.objects.get(product_code="SALARY_ADVANCE")
    super_admin = UserFactory(email="sa-product-lock@test.com", is_superuser=True)
    _assign_role(super_admin, "super-admin")
    lead = _create_lead(lead_code="CVT-SA-001", product=payday)

    response = _convert(APIClient(), super_admin, lead, other.id)

    assert response.status_code == status.HTTP_201_CREATED
    assert str(response.data["data"]["application"]["product"]) == str(other.id)
