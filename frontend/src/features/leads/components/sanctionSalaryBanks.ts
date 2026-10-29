import type { ApiBank } from '@/lib/banksApi';
import type { ApiSanctionSalaryBank } from '@/lib/leadDetailsApi';

export function apiSalaryBanksToBankIds(banks?: ApiSanctionSalaryBank[]): string[] {
  return (banks ?? [])
    .map((bank) => bank.bank_id?.trim())
    .filter(Boolean);
}

export function bankIdsToApiSalaryBanks(
  bankIds: string[],
  banks: ApiBank[],
): ApiSanctionSalaryBank[] {
  return bankIds
    .map((bankId) => {
      const bank = banks.find((item) => item.id === bankId);
      if (!bank) return null;
      return {
        bank_id: bank.id,
        bank_name: bank.name,
        account_number: '',
      };
    })
    .filter((entry): entry is ApiSanctionSalaryBank => entry != null);
}

export function validateSelectedBankIds(bankIds: string[]): string | null {
  const selected = bankIds.map((bankId) => bankId.trim()).filter(Boolean);
  if (!selected.length) {
    return 'Salary account is required.';
  }
  const unique = new Set(selected);
  if (unique.size !== selected.length) {
    return 'Duplicate salary banks are not allowed.';
  }
  return null;
}

export function resolveSalaryBankIdsFromRecord(
  record: { salary_banks?: ApiSanctionSalaryBank[]; bank?: string },
  banks: ApiBank[],
): string[] {
  const fromApi = apiSalaryBanksToBankIds(record.salary_banks);
  if (fromApi.length) {
    return fromApi;
  }

  const label = record.bank?.trim();
  if (!label || !banks.length) {
    return [];
  }

  return label
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => banks.find((bank) => bank.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((bankId): bankId is string => Boolean(bankId));
}
