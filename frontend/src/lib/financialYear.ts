/** Indian financial year (Apr–Mar): return the April-start calendar year. */
export function financialYearStartFromDate(value: Date): number {
  return value.getMonth() >= 3 ? value.getFullYear() : value.getFullYear() - 1;
}

export function financialYearStartDate(financialYearStart: number): Date {
  return new Date(financialYearStart, 3, 1);
}

export function financialYearEndDate(financialYearStart: number): Date {
  return new Date(financialYearStart + 1, 2, 31);
}

export function formatFinancialYearLabel(financialYearStart: number): string {
  const endSuffix = String(financialYearStart + 1).slice(-2);
  return `${financialYearStart}-${endSuffix}`;
}

/** Bank holiday master: allowed FY range (2026-27 through 2036-37). */
export const BANK_HOLIDAY_FINANCIAL_YEAR_MIN = 2026;
export const BANK_HOLIDAY_FINANCIAL_YEAR_MAX = 2036;

export function buildBankHolidayFinancialYearOptions(): number[] {
  const years: number[] = [];
  for (
    let year = BANK_HOLIDAY_FINANCIAL_YEAR_MIN;
    year <= BANK_HOLIDAY_FINANCIAL_YEAR_MAX;
    year += 1
  ) {
    years.push(year);
  }
  return years;
}

export function defaultBankHolidayFinancialYearStart(reference = new Date()): number {
  const current = financialYearStartFromDate(reference);
  return Math.min(
    BANK_HOLIDAY_FINANCIAL_YEAR_MAX,
    Math.max(BANK_HOLIDAY_FINANCIAL_YEAR_MIN, current),
  );
}

export function isAllowedBankHolidayFinancialYear(financialYearStart: number): boolean {
  return (
    financialYearStart >= BANK_HOLIDAY_FINANCIAL_YEAR_MIN &&
    financialYearStart <= BANK_HOLIDAY_FINANCIAL_YEAR_MAX
  );
}

export function buildFinancialYearOptions(anchorYear = financialYearStartFromDate(new Date()), span = 2): number[] {
  const years: number[] = [];
  for (let year = anchorYear - span; year <= anchorYear + span; year += 1) {
    years.push(year);
  }
  return years;
}

export function dateWithinFinancialYear(value: Date, financialYearStart: number): boolean {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const start = financialYearStartDate(financialYearStart);
  const end = financialYearEndDate(financialYearStart);
  return day >= start && day <= end;
}

export function currentFinancialYearStart(reference = new Date()): number {
  return financialYearStartFromDate(reference);
}

export function toIsoDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDateOnly(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
}

export function isoDateInFinancialYear(isoDate: string, financialYearStart: number): boolean {
  const parsed = parseIsoDateOnly(isoDate);
  if (!parsed) return false;
  return dateWithinFinancialYear(parsed, financialYearStart);
}

export function formatFinancialYearRangeLabel(financialYearStart: number): string {
  const start = financialYearStartDate(financialYearStart);
  const end = financialYearEndDate(financialYearStart);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}
