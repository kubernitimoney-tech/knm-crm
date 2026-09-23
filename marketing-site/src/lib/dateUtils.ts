export const MIN_BORROWER_AGE_YEARS = 21;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function maxDateOfBirth(referenceDate = new Date()): Date {
  const date = new Date(referenceDate);
  date.setFullYear(date.getFullYear() - MIN_BORROWER_AGE_YEARS);
  return date;
}

export function minBirthYear(referenceDate = new Date()): number {
  return referenceDate.getFullYear() - 80;
}

export function maxBirthYear(referenceDate = new Date()): number {
  return maxDateOfBirth(referenceDate).getFullYear();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function parseIsoDate(value?: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDisplayDate(value?: string): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getMonthOptions() {
  return MONTHS.map((label, index) => ({ value: index + 1, label }));
}

export function getYearOptions(fromYear: number, toYear: number) {
  const years: number[] = [];
  for (let year = toYear; year >= fromYear; year -= 1) {
    years.push(year);
  }
  return years;
}

export function getDayOptions(year: number, month: number) {
  const total = daysInMonth(year, month);
  return Array.from({ length: total }, (_, index) => index + 1);
}

export function isAtLeast21(dob: string, referenceDate = new Date()): boolean {
  const birth = parseIsoDate(dob);
  if (!birth) return true;
  const cutoff = maxDateOfBirth(referenceDate);
  return birth <= cutoff;
}
