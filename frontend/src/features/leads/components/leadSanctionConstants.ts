import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { formatDisplayDate, parseIsoDate, stripTime, toIsoDate } from '@/lib/dateUtils';
import type { ApiLoanProduct } from '@/lib/applicationsApi';

export const REJECTION_REASON_OPTIONS = [
  'Low CIBIL Score',
  'High Debt-to-Income Ratio',
  'Incomplete Documentation',
  'Employment Verification Failed',
  'Bank Statement Mismatch',
  'Policy Exception Denied',
  'Customer Withdrawal',
  'Disbursal Hold',
  'Sanction Reversal',
  'Other',
] as const;

export const RESIDENTIAL_TYPE_OPTIONS = [
  'Own',
  'Rented',
] as const;

export { EMPLOYMENT_TYPE_LABELS as EMPLOYMENT_TYPE_OPTIONS } from '@/constants/employmentTypes';

export { LOAN_PURPOSE_OPTIONS } from '@/constants/loanPurposes';

export const SANCTION_REPAYMENT_MIN_DAYS = 7;
export const SANCTION_REPAYMENT_MAX_DAYS = 40;

export function resolveRepaymentTenureLimits(product?: ApiLoanProduct | null): {
  minDays: number;
  maxDays: number;
} {
  if (product?.tenure_unit === 'days') {
    const minDays = Number(product.min_tenure);
    const maxDays = Number(product.max_tenure);
    if (Number.isFinite(minDays) && Number.isFinite(maxDays) && minDays > 0 && maxDays >= minDays) {
      return { minDays, maxDays };
    }
  }
  return { minDays: SANCTION_REPAYMENT_MIN_DAYS, maxDays: SANCTION_REPAYMENT_MAX_DAYS };
}

/** Tenure in days = repayment date − disbursal date. */
export function computeTenureDays(
  repaymentDate: string,
  disbursalDate: Date = new Date(),
): number | undefined {
  const repay = parseIsoDate(repaymentDate.trim());
  if (!repay) return undefined;
  return Math.max(differenceInCalendarDays(startOfDay(repay), startOfDay(disbursalDate)), 0);
}

export function getSanctionRepaymentDateBounds(
  disbursalDate = new Date(),
  limits = resolveRepaymentTenureLimits(),
) {
  const base = startOfDay(disbursalDate);
  return {
    minDate: addDays(base, limits.minDays),
    maxDate: addDays(base, limits.maxDays),
    ...limits,
  };
}

/** Select options for sanction repayment date — skips Sundays and bank holidays. */
export function buildSanctionRepaymentDateOptions(
  disbursalDate = new Date(),
  limits = resolveRepaymentTenureLimits(),
  bankHolidayLabels?: Record<string, string>,
): { value: string; label: string }[] {
  const base = startOfDay(disbursalDate);
  const { minDate, maxDate } = getSanctionRepaymentDateBounds(disbursalDate, limits);
  const options: { value: string; label: string }[] = [];
  let current = startOfDay(minDate);
  const end = startOfDay(maxDate);

  while (current <= end) {
    const isoValue = toIsoDate(current);
    if (!isSundayDate(current) && !resolveBankHolidayName(isoValue, bankHolidayLabels)) {
      const tenureDays = differenceInCalendarDays(current, base);
      options.push({
        value: isoValue,
        label: `${formatDisplayDate(isoValue)} (${tenureDays} days)`,
      });
    }
    current = addDays(current, 1);
  }

  return options;
}

export function isSundayDate(value: Date): boolean {
  return stripTime(value).getDay() === 0;
}

export function resolveBankHolidayName(
  isoDate: string,
  bankHolidayLabels?: Record<string, string>,
): string | undefined {
  const trimmed = isoDate.trim().slice(0, 10);
  if (!trimmed || !bankHolidayLabels) return undefined;
  return bankHolidayLabels[trimmed];
}

export function validateSanctionRepaymentDate(
  value: string,
  limits = resolveRepaymentTenureLimits(),
  disbursalDate = new Date(),
  bankHolidayLabels?: Record<string, string>,
): string | null {
  if (!value.trim()) {
    return 'Repayment date is required.';
  }
  const repay = parseIsoDate(value.trim());
  if (!repay) {
    return 'Repayment date is invalid.';
  }
  const tenureDays = computeTenureDays(value, disbursalDate);
  if (tenureDays == null) {
    return 'Repayment date is invalid.';
  }
  if (tenureDays < limits.minDays || tenureDays > limits.maxDays) {
    return `Repayment date must be ${limits.minDays}–${limits.maxDays} days after disbursal date.`;
  }
  if (isSundayDate(repay)) {
    return 'Repayment date cannot fall on a Sunday.';
  }
  const holidayName = resolveBankHolidayName(value, bankHolidayLabels);
  if (holidayName) {
    return `Repayment date cannot fall on a bank holiday (${holidayName}).`;
  }
  return null;
}

export function computeSanctionRepaymentTenureDays(
  repaymentDate: string,
  limits = resolveRepaymentTenureLimits(),
  disbursalDate = new Date(),
  bankHolidayLabels?: Record<string, string>,
): number | undefined {
  if (validateSanctionRepaymentDate(repaymentDate, limits, disbursalDate, bankHolidayLabels)) {
    return undefined;
  }
  return computeTenureDays(repaymentDate, disbursalDate);
}

export function buildRoiOptions(): string[] {
  const options: string[] = [];
  for (let value = 1.0; value >= 0.499; value -= 0.05) {
    options.push(value.toFixed(2));
  }
  return options;
}

export function buildCountOptions(max = 10): string[] {
  return Array.from({ length: max + 1 }, (_, index) => String(index));
}

export function buildPfPercentageOptions(): string[] {
  const options: string[] = [];
  for (let value = 10; value >= 7.999; value -= 0.5) {
    options.push(value.toFixed(2));
  }
  return options;
}

export function ensureSelectOption(options: string[], value: string): string[] {
  if (!value || options.includes(value)) {
    return options;
  }
  return [...options, value].sort((left, right) => Number(left) - Number(right));
}

export function ensureNumericSelectOption(
  options: string[],
  value: string,
  order: 'asc' | 'desc' = 'desc',
): string[] {
  const merged = !value || options.includes(value) ? [...options] : [...options, value];
  return merged.sort((left, right) => {
    const diff = Number(left) - Number(right);
    return order === 'desc' ? -diff : diff;
  });
}

export const ROI_OPTIONS = buildRoiOptions();
export const PF_PERCENTAGE_OPTIONS = buildPfPercentageOptions();
export const COUNT_OPTIONS = buildCountOptions(10);
