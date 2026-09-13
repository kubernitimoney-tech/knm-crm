from datetime import date

BANK_HOLIDAY_FINANCIAL_YEAR_MIN = 2026
BANK_HOLIDAY_FINANCIAL_YEAR_MAX = 2036


def financial_year_start_from_date(value: date) -> int:
    """Indian financial year (Apr–Mar): return the April-start calendar year."""
    return value.year if value.month >= 4 else value.year - 1


def financial_year_end_date(financial_year_start: int) -> date:
    return date(financial_year_start + 1, 3, 31)


def financial_year_start_date(financial_year_start: int) -> date:
    return date(financial_year_start, 4, 1)


def financial_year_label(financial_year_start: int) -> str:
    end_suffix = str(financial_year_start + 1)[-2:]
    return f"{financial_year_start}-{end_suffix}"


def date_within_financial_year(value: date, financial_year_start: int) -> bool:
    return (
        financial_year_start_date(financial_year_start)
        <= value
        <= financial_year_end_date(financial_year_start)
    )


def is_allowed_bank_holiday_financial_year(financial_year_start: int) -> bool:
    return (
        BANK_HOLIDAY_FINANCIAL_YEAR_MIN <= financial_year_start <= BANK_HOLIDAY_FINANCIAL_YEAR_MAX
    )
