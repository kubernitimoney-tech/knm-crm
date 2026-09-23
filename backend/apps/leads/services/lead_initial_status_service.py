from apps.leads.models import LeadCategory, LeadStatus
from apps.loans.models import Loan


def customer_has_disbursed_loan(customer) -> bool:
    """True when the customer has at least one disbursed loan."""
    return Loan.objects.filter(
        customer=customer,
        is_deleted=False,
        disbursed_at__isnull=False,
    ).exists()


def customer_qualifies_for_reloan(customer) -> bool:
    """Reloan intake applies only after a prior loan has been disbursed."""
    return customer_has_disbursed_loan(customer)


def resolve_initial_lead_category(customer) -> str:
    if customer_qualifies_for_reloan(customer):
        return LeadCategory.RELOAN
    return LeadCategory.FRESH


def resolve_initial_lead_status(customer) -> str:
    if customer_qualifies_for_reloan(customer):
        return LeadStatus.RELOAN
    return LeadStatus.FRESH
