from .loan_product import InterestType, LoanProduct, ProcessingFeeType, TenureUnit

# Backward-compatible alias for older imports.
InterestCalculation = InterestType

__all__ = [
    "LoanProduct",
    "TenureUnit",
    "InterestType",
    "InterestCalculation",
    "ProcessingFeeType",
]
