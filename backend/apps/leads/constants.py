"""Canonical loan purpose labels (A–Z, with Others last)."""

from decimal import Decimal

LOAN_PURPOSE_OPTIONS = (
    "Buying gadgets",
    "Down-payment shortfall",
    "Home interiors",
    "Household fund shortage",
    "Immediate purchase",
    "Loan for paying school fees",
    "Loan repayment",
    "Loan to clear bills",
    "Medical emergency",
    "Meeting immediate commitment",
    "Personal",
    "Travel fund shortage",
    "Wedding",
    "Others",
)

LOAN_PURPOSE_SET = frozenset(LOAN_PURPOSE_OPTIONS)

MIN_LEAD_MONTHLY_INCOME = Decimal("40000")

MAX_LEADS_PER_CUSTOMER_PER_HOUR = 2
