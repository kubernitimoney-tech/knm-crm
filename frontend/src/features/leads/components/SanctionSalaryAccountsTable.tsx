import React, { useMemo } from 'react';
import Select, { type MultiValue } from 'react-select';
import { FormFieldLabel } from '@/features/leads/components/leadDetailSectionShared';
import type { ApiBank } from '@/lib/banksApi';
import type { ApiSanctionSalaryBank } from '@/lib/leadDetailsApi';
import { cn } from '@/lib/utils';
import { selectPlaceholder } from '@/lib/placeholders';

export interface SanctionSalaryBankRow {
  bankId: string;
  bankName: string;
}

export type BankSelectOption = {
  value: string;
  label: string;
};

interface SanctionSalaryBankMultiSelectProps {
  selectedBankIds: string[];
  banks: ApiBank[];
  onChange: (bankIds: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

const sanctionBankSelectControlClass = cn(
  'h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2 text-[11px] font-medium text-slate-600 shadow-none transition-colors outline-none',
  'dark:border-slate-700 dark:bg-input/30 dark:text-slate-200',
);

const sanctionBankSelectClassNames = {
  control: ({ isFocused, isDisabled }: { isFocused: boolean; isDisabled: boolean }) =>
    cn(
      sanctionBankSelectControlClass,
      'flex cursor-text items-center gap-1 py-0',
      isFocused && 'border-ring ring-3 ring-ring/50',
      isDisabled && 'cursor-not-allowed opacity-50',
    ),
  valueContainer: () => 'flex flex-wrap gap-1 px-0 py-0.5',
  input: () => 'm-0 p-0 text-[11px] font-medium text-slate-600 dark:text-slate-200',
  placeholder: () => 'text-[11px] text-muted-foreground',
  multiValue: () =>
    'inline-flex items-center rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800',
  multiValueLabel: () => 'px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200',
  multiValueRemove: () =>
    'rounded-r-md px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100',
  indicatorsContainer: () => 'shrink-0 gap-0.5',
  clearIndicator: () => 'cursor-pointer p-1 text-muted-foreground hover:text-foreground',
  dropdownIndicator: () => 'cursor-pointer p-1 text-muted-foreground',
  menuPortal: () => 'z-[200]',
  menu: () =>
    'mt-1 overflow-hidden rounded-lg border border-slate-200 bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 dark:border-slate-700 dark:bg-[#252849] dark:text-slate-100 dark:ring-white/10',
  menuList: () => 'max-h-52 overflow-y-auto p-1 text-[11px]',
  option: ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
    cn(
      'cursor-pointer rounded-md px-2 py-1.5 font-medium text-slate-600 dark:text-slate-200',
      isFocused && 'bg-slate-100 dark:bg-slate-800',
      isSelected && 'bg-slate-100 font-semibold dark:bg-slate-800',
    ),
  noOptionsMessage: () => 'px-2 py-1.5 text-[11px] text-muted-foreground',
};

function resolveBankLabel(bankId: string, banks: ApiBank[]): string {
  return banks.find((bank) => bank.id === bankId)?.name ?? bankId;
}

function toBankOptions(banks: ApiBank[]): BankSelectOption[] {
  return banks.map((bank) => ({ value: bank.id, label: bank.name }));
}

function toSelectedOptions(
  selectedBankIds: string[],
  banks: ApiBank[],
): BankSelectOption[] {
  return selectedBankIds.map((bankId) => ({
    value: bankId,
    label: resolveBankLabel(bankId, banks),
  }));
}

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

/** @deprecated Use bankIdsToApiSalaryBanks */
export function rowsToApiSalaryBanks(rows: SanctionSalaryBankRow[]): ApiSanctionSalaryBank[] {
  return rows
    .filter((row) => row.bankId.trim())
    .map((row) => ({
      bank_id: row.bankId,
      bank_name: row.bankName,
      account_number: '',
    }));
}

/** @deprecated Use apiSalaryBanksToBankIds */
export function apiSalaryBanksToRows(banks?: ApiSanctionSalaryBank[]): SanctionSalaryBankRow[] {
  return (banks ?? [])
    .filter((bank) => bank.bank_id?.trim())
    .map((bank) => ({
      bankId: bank.bank_id,
      bankName: bank.bank_name,
    }));
}

export function SanctionSalaryBankMultiSelect({
  selectedBankIds,
  banks,
  onChange,
  readOnly = false,
  className,
}: SanctionSalaryBankMultiSelectProps) {
  const options = useMemo(() => toBankOptions(banks), [banks]);
  const value = useMemo(
    () => toSelectedOptions(selectedBankIds, banks),
    [banks, selectedBankIds],
  );

  const handleChange = (selected: MultiValue<BankSelectOption>) => {
    onChange(selected.map((option) => option.value));
  };

  if (readOnly) {
    if (!value.length) {
      return <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">—</p>;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((option) => (
          <span
            key={option.value}
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {option.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1 md:col-span-2 lg:col-span-4', className)}>
      <FormFieldLabel required>Salary Account</FormFieldLabel>
      <Select<BankSelectOption, true>
        isMulti
        isSearchable
        isClearable
        unstyled
        closeMenuOnSelect
        hideSelectedOptions
        options={options}
        value={value}
        onChange={handleChange}
        placeholder={selectPlaceholder('Salary banks')}
        noOptionsMessage={({ inputValue }) =>
          inputValue.trim() ? 'No banks found.' : 'No banks available.'
        }
        classNames={sanctionBankSelectClassNames}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
      />
    </div>
  );
}

/** @deprecated Use SanctionSalaryBankMultiSelect */
export const SanctionSalaryAccountsTable = SanctionSalaryBankMultiSelect;

/** @deprecated Use SanctionSalaryBankMultiSelect props */
export function createSanctionSalaryBankRow(partial?: Partial<SanctionSalaryBankRow>): SanctionSalaryBankRow {
  return {
    bankId: partial?.bankId ?? '',
    bankName: partial?.bankName ?? '',
  };
}

/** @deprecated Use validateSelectedBankIds */
export function validateSanctionSalaryBankRows(rows: SanctionSalaryBankRow[]): string | null {
  return validateSelectedBankIds(rows.map((row) => row.bankId));
}
