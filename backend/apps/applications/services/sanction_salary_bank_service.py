"""Sync salary bank references on loan sanction decisions."""

from __future__ import annotations

from apps.applications.models import SanctionSalaryBank
from apps.organization.models import Bank


class SanctionSalaryBankServiceError(ValueError):
    pass


def _as_string(value) -> str:
    return str(value or "").strip()


def normalize_salary_banks(raw_entries) -> list[dict[str, str]]:
    if not raw_entries:
        return []

    if not isinstance(raw_entries, list):
        raise SanctionSalaryBankServiceError("Salary banks must be a list.")

    normalized: list[dict[str, str]] = []
    seen_bank_ids: set[str] = set()

    for index, entry in enumerate(raw_entries, start=1):
        if not isinstance(entry, dict):
            raise SanctionSalaryBankServiceError(f"Salary bank row {index} is invalid.")

        bank_id = _as_string(entry.get("bank_id") or entry.get("bankId"))
        bank_name = _as_string(entry.get("bank_name") or entry.get("bankName"))
        account_number = _as_string(entry.get("account_number") or entry.get("accountNumber"))

        if not bank_id and not bank_name:
            continue

        bank = None
        if bank_id:
            bank = Bank.objects.filter(id=bank_id, is_active=True).first()
            if not bank:
                raise SanctionSalaryBankServiceError(
                    f"Salary bank row {index} has an invalid bank."
                )
            bank_id = str(bank.id)
            bank_name = bank.name
        elif bank_name:
            bank = Bank.objects.filter(name__iexact=bank_name, is_active=True).first()
            if not bank:
                raise SanctionSalaryBankServiceError(
                    f"Salary bank row {index} has an unknown bank name."
                )
            bank_id = str(bank.id)
            bank_name = bank.name

        if bank_id in seen_bank_ids:
            raise SanctionSalaryBankServiceError("Duplicate salary banks are not allowed.")
        seen_bank_ids.add(bank_id)

        normalized.append(
            {
                "bank_id": bank_id,
                "bank_name": bank_name,
                "account_number": account_number,
            }
        )

    return normalized


def legacy_salary_banks_from_details(details: dict | None) -> list[dict[str, str]]:
    if not details:
        return []

    existing = details.get("salary_banks")
    if isinstance(existing, list) and existing:
        return normalize_salary_banks(existing)

    bank_name = _as_string(details.get("bank_name"))
    account_number = _as_string(details.get("salary_account"))
    if not bank_name:
        return []

    bank = Bank.objects.filter(name__iexact=bank_name, is_active=True).first()
    if not bank:
        return [
            {
                "bank_id": "",
                "bank_name": bank_name,
                "account_number": account_number,
            }
        ]

    return [
        {
            "bank_id": str(bank.id),
            "bank_name": bank.name,
            "account_number": account_number,
        }
    ]


def apply_primary_salary_fields(details: dict, salary_banks: list[dict[str, str]]) -> dict:
    updated = dict(details or {})
    updated["salary_banks"] = salary_banks

    if not salary_banks:
        return updated

    primary_account = next(
        (entry["account_number"] for entry in salary_banks if entry.get("account_number")),
        "",
    )
    if primary_account:
        updated["salary_account"] = primary_account

    bank_names = [entry["bank_name"] for entry in salary_banks if entry.get("bank_name")]
    if bank_names:
        updated["bank_name"] = ", ".join(bank_names)

    return updated


def prepare_sanction_details(details: dict | None) -> dict:
    salary_banks = normalize_salary_banks((details or {}).get("salary_banks"))
    if not salary_banks:
        salary_banks = legacy_salary_banks_from_details(details)
    if not salary_banks:
        raise SanctionSalaryBankServiceError("Salary account is required.")
    return apply_primary_salary_fields(details or {}, salary_banks)


def sync_decision_salary_banks(*, decision, sanction_details: dict | None) -> None:
    salary_banks = normalize_salary_banks((sanction_details or {}).get("salary_banks"))
    if not salary_banks:
        salary_banks = legacy_salary_banks_from_details(sanction_details)

    SanctionSalaryBank.objects.filter(decision=decision).delete()
    for entry in salary_banks:
        bank_id = entry.get("bank_id")
        if not bank_id:
            continue
        SanctionSalaryBank.objects.create(
            decision=decision,
            bank_id=bank_id,
            account_number=entry.get("account_number") or "",
        )


def salary_banks_for_decision(decision) -> list[dict[str, str]]:
    links = decision.salary_bank_links.select_related("bank").order_by("created_at").all()
    if links:
        return [
            {
                "bank_id": str(link.bank_id),
                "bank_name": link.bank.name,
                "account_number": link.account_number or "",
            }
            for link in links
        ]

    details = decision.sanction_details or {}
    if isinstance(details.get("salary_banks"), list):
        return [
            {
                "bank_id": _as_string(entry.get("bank_id")),
                "bank_name": _as_string(entry.get("bank_name")),
                "account_number": _as_string(entry.get("account_number")),
            }
            for entry in details["salary_banks"]
            if isinstance(entry, dict)
        ]

    return legacy_salary_banks_from_details(details)
