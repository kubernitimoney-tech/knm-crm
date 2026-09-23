from __future__ import annotations

from apps.core.services.ifsc_service import resolve_ifsc_bank_details
from apps.customers.models import AddressType
from apps.organization.models import CompanyAccount

ADDRESS_TYPE_PRIORITY = (
    AddressType.OWN,
    AddressType.RENTED,
)


def _sorted_prefetched(items, *, attr: str):
    if not items:
        return []
    return sorted(items, key=lambda item: getattr(item, attr), reverse=True)


def resolve_current_employment(customer):
    employments = _sorted_prefetched(list(customer.employments.all()), attr="created_at")
    if not employments:
        return None
    current = [row for row in employments if row.is_current]
    return current[0] if current else employments[0]


def resolve_customer_address(customer):
    addresses = list(customer.addresses.all())
    if not addresses:
        return None
    by_type = {row.address_type: row for row in addresses}
    for address_type in ADDRESS_TYPE_PRIORITY:
        if address_type in by_type:
            return by_type[address_type]
    return addresses[0]


def _pick_company_account(qs):
    return qs.order_by("-is_default", "-created_at").first()


def resolve_company_disbursal_account(*, branch=None):
    """Return the active loan company account used for disbursal (finance master data)."""
    active = CompanyAccount.objects.filter(is_active=True)
    if branch is not None:
        branch_match = _pick_company_account(active.filter(branch=branch))
        if branch_match:
            return branch_match
        global_match = _pick_company_account(active.filter(branch__isnull=True))
        if global_match:
            return global_match
        default_match = _pick_company_account(active.filter(is_default=True))
        if default_match:
            return default_match
        return _pick_company_account(active)
    return _pick_company_account(active)


def resolve_customer_salary_account(application):
    """Customer salary account from bank master or latest sanction details."""
    bank_account = (
        application.customer.bank_accounts.filter(is_salary_account=True)
        .order_by("-created_at")
        .first()
    )
    if bank_account:
        return bank_account.account_number

    decision = application.decisions.filter(decision="approved").order_by("-decided_at").first()
    if decision:
        details = dict(decision.sanction_details or {})
        salary_account = str(details.get("salary_account") or "").strip()
        if salary_account:
            return salary_account
    return ""


def resolve_beneficiary_disbursal_defaults(application):
    """Pre-fill beneficiary bank details on a new disbursal sheet."""
    account_number = resolve_customer_salary_account(application)
    ifsc_code = ""
    bank_name = ""
    branch_name = ""

    bank_account = (
        application.customer.bank_accounts.filter(is_salary_account=True)
        .order_by("-created_at")
        .first()
        or application.customer.bank_accounts.filter(is_primary=True)
        .order_by("-created_at")
        .first()
        or application.customer.bank_accounts.order_by("-created_at").first()
    )
    if bank_account:
        ifsc_code = bank_account.ifsc_code
        bank_name = bank_account.bank_name

    if ifsc_code:
        ifsc_details = resolve_ifsc_bank_details(ifsc_code)
        if not bank_name:
            bank_name = ifsc_details["bank_name"]
        branch_name = ifsc_details["branch"]

    return {
        "account_number": account_number,
        "ifsc_code": ifsc_code,
        "bank_name": bank_name,
        "branch": branch_name,
    }


def resolve_location(lead):
    customer_address = resolve_customer_address(lead.customer)
    if customer_address:
        return customer_address.city, customer_address.state, customer_address.pincode

    return "", "", ""
