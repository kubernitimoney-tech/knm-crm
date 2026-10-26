import { endOfDay, endOfMonth, format, isWithinInterval, startOfDay, startOfMonth, subDays } from 'date-fns';

export type PeriodFilter = 'All Time' | 'Today' | 'Last 7 Days' | 'Current Month' | 'Custom' | string;

/** Parse an API date ("2026-10-15" or ISO datetime) as a local date. */
export function parseListingDate(value: string | null | undefined): Date | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True when `value` falls in the selected period. Periods are bounded on both
 * sides, so future dates (e.g. upcoming repay dates) are not counted as
 * "Last 7 Days". Rows without a date only match "All Time".
 */
export function matchesPeriodFilter(
  value: string | null | undefined,
  period: PeriodFilter,
  range: { from?: Date; to?: Date },
): boolean {
  if (period === 'All Time' || (period === 'Custom' && !(range.from && range.to))) return true;
  const date = parseListingDate(value);
  if (!date) return false;
  const now = new Date();
  if (period === 'Today') {
    return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(now) });
  }
  if (period === 'Last 7 Days') {
    return isWithinInterval(date, { start: startOfDay(subDays(now, 6)), end: endOfDay(now) });
  }
  if (period === 'Current Month') {
    return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
  }
  if (period === 'Custom' && range.from && range.to) {
    return isWithinInterval(date, { start: startOfDay(range.from), end: endOfDay(range.to) });
  }
  return true;
}

/** Period selection as an API date range (YYYY-MM-DD, inclusive); empty for All Time. */
export function periodToDateRange(
  period: PeriodFilter,
  range: { from?: Date; to?: Date },
): { date_from?: string; date_to?: string } {
  const now = new Date();
  const fmt = (date: Date) => format(date, 'yyyy-MM-dd');
  if (period === 'Today') return { date_from: fmt(now), date_to: fmt(now) };
  if (period === 'Last 7 Days') return { date_from: fmt(subDays(now, 6)), date_to: fmt(now) };
  if (period === 'Current Month') {
    return { date_from: fmt(startOfMonth(now)), date_to: fmt(endOfMonth(now)) };
  }
  if (period === 'Custom' && range.from && range.to) {
    return { date_from: fmt(range.from), date_to: fmt(range.to) };
  }
  return {};
}
