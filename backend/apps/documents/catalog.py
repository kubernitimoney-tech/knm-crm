"""Known customer/lead document type codes and display labels."""

LEAD_DOCUMENT_TYPE_CATALOG: dict[str, tuple[str, bool]] = {
    "pan": ("PAN Card", True),
    "aadhaar": ("Aadhaar Card", True),
    "salary_slip": ("Salary Slip", True),
    "bank_statement": ("Bank Statement", True),
    "photograph": ("Photograph", True),
    "cibil_report": ("Cibil Report", False),
    "id_card": ("ID Card", False),
    "cheque": ("Cheque", False),
    "electricity_bill": ("Electricity Bill", False),
    "mobile_bill": ("Mobile Bill", False),
    "others": ("Others", False),
}

LEAD_DOCUMENT_TYPE_CODES = frozenset(LEAD_DOCUMENT_TYPE_CATALOG.keys())
