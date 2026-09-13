import { endOfMonth, format, isValid, parse, startOfMonth, subMonths, subYears } from 'date-fns';

/** Minimum borrower age for payday / personal loan products. */
export const MIN_BORROWER_AGE_YEARS = 21;

/** Latest selectable date of birth (customer must be at least 21 years old). */
export function maxDateOfBirth(referenceDate = new Date()): Date {
  return subYears(referenceDate, MIN_BORROWER_AGE_YEARS);
}

/** Application timezone — Indian Standard Time (IST, UTC+5:30). */
export const APP_TIMEZONE = 'Asia/Kolkata';
export const APP_LOCALE = 'en-IN';

/** UI date: 27-06-2025 */
export const DISPLAY_DATE_FORMAT = 'dd-MM-yyyy';
/** UI date-time: 27-06-2025 03:45 PM */
export const DISPLAY_DATETIME_FORMAT = 'dd-MM-yyyy hh:mm a';
/** UI date-time with seconds: 27-06-2025 03:45:30 PM */
export const DISPLAY_DATETIME_SECONDS_FORMAT = 'dd-MM-yyyy hh:mm:ss a';

/** Strip time from a date for calendar-day comparisons. */
export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() === stripTime(b).getTime();
}

export function getToday(): Date {
  return stripTime(new Date());
}

/** Default filter range: first through last day of the previous calendar month. */
export function getDefaultDateRange(referenceDate = new Date()): { from: Date; to: Date } {
  const previousMonth = subMonths(referenceDate, 1);
  return {
    from: stripTime(startOfMonth(previousMonth)),
    to: stripTime(endOfMonth(previousMonth)),
  };
}

/** Earliest allowed From date for a given To date (To − 1 year + 1 day). */
export function getMinFromDate(to: Date): Date {
  const min = new Date(to);
  min.setFullYear(min.getFullYear() - 1);
  min.setDate(min.getDate() + 1);
  return stripTime(min);
}

/** Latest allowed To date for a given From date (From + 1 year − 1 day). */
export function getMaxToDateForFrom(from: Date): Date {
  const max = new Date(from);
  max.setFullYear(max.getFullYear() + 1);
  max.setDate(max.getDate() - 1);
  return stripTime(max);
}

export type DateRangeValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validateDateRange(
  from: Date,
  to: Date,
  today: Date = getToday(),
): DateRangeValidationResult {
  const fromDate = stripTime(from);
  const toDate = stripTime(to);
  const minFrom = getMinFromDate(toDate);

  if (toDate > stripTime(today)) {
    return { valid: false, message: 'To date cannot be after today.' };
  }
  if (fromDate > toDate) {
    return { valid: false, message: 'From date cannot be after To date.' };
  }
  if (fromDate < minFrom) {
    return {
      valid: false,
      message: 'From date cannot be more than one year before To date.',
    };
  }
  return { valid: true };
}

export function parseIsoDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** FI date on disbursal sheet must not be after today (when provided). */
export function validateFiDateNotAfterToday(
  value: string,
  options: { label?: string } = {},
): string | null {
  const { label = 'FI date' } = options;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseIsoDate(trimmed);
  if (!parsed) {
    return `${label} is invalid.`;
  }
  if (stripTime(parsed) > getToday()) {
    return `${label} cannot be after today.`;
  }
  return null;
}

export function toIsoDate(date?: Date | null): string {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
}

export function formatDisplayDate(value?: string | null, pattern = DISPLAY_DATE_FORMAT): string {
  const parsed = parseIsoDate(value ?? undefined);
  return parsed ? format(parsed, pattern) : '';
}

function toDate(value: Date | string): Date | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function appTimezoneParts(date: Date, includeTime: boolean, includeSeconds = false) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
    if (includeSeconds) {
      options.second = '2-digit';
    }
  }
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: pick('day'),
    month: pick('month'),
    year: pick('year'),
    hour: includeTime ? pick('hour') : '',
    minute: includeTime ? pick('minute') : '',
    second: includeTime && includeSeconds ? pick('second') : '',
    dayPeriod: includeTime ? pick('dayPeriod').toUpperCase() : '',
  };
}

/** Format a date/time in IST regardless of browser or container timezone. */
export function formatInAppTimezone(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '';
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...options,
  }).format(date);
}

/** Format date-only values for UI (dd-MM-yyyy). */
export function formatAppDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  if (!date) return '';
  const { day, month, year } = appTimezoneParts(date, false);
  return `${day}-${month}-${year}`;
}

/** Format datetime values for UI (dd-MM-yyyy hh:mm AM/PM). */
export function formatAppDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  if (!date) return '';
  const { day, month, year, hour, minute, dayPeriod } = appTimezoneParts(date, true);
  return `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod}`;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Format datetime values for UI (dd-MM-yyyy hh:mm:ss AM/PM). */
export function formatAppDateTimeWithSeconds(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  if (!date) return '';
  const { day, month, year, hour, minute, second, dayPeriod } = appTimezoneParts(date, true, true);
  return `${day}-${month}-${year} ${hour}:${minute}:${second} ${dayPeriod}`;
}

export function formatAppDateTimeWithSecondsOrFallback(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  if (!value) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (ISO_DATE_ONLY.test(raw)) {
    return `${formatAppDate(raw)} 12:00:00 AM`;
  }
  return formatAppDateTimeWithSeconds(raw) || fallback;
}

export function formatAppDateOrFallback(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  return formatAppDate(value) || fallback;
}

export function formatAppDateTimeOrFallback(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  return formatAppDateTime(value) || fallback;
}

/** Date-only ISO values render as dd-MM-yyyy; datetimes render with time. */
export function formatAppDateField(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  if (!value) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (ISO_DATE_ONLY.test(raw)) {
    return formatAppDate(raw) || fallback;
  }
  return formatAppDateTime(raw) || fallback;
}

/** API / ISO datetime → `datetime-local` input value (`YYYY-MM-DDTHH:mm`). */
export function toDateTimeLocalInputValue(value?: string | null): string {
  if (!value?.trim()) return '';
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return '';
  return `${match[1]}T${match[2]}`;
}

/** `datetime-local` input value → API datetime (`YYYY-MM-DDTHH:mm:ss`). */
export function fromDateTimeLocalInputValue(value?: string | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
}

/** Current moment as `datetime-local` value in app timezone (for input `max`). */
export function currentDateTimeLocalInputValue(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}`;
}

/** Validate collection datetime is not in the future (app timezone). */
export function validateDateTimeLocalNotAfterNow(value?: string | null): string | null {
  if (!value?.trim()) {
    return 'Collection date and time is required.';
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return 'Invalid collection date and time.';
  }
  const selectedMs = Date.parse(fromDateTimeLocalInputValue(trimmed));
  if (Number.isNaN(selectedMs)) {
    return 'Invalid collection date and time.';
  }
  const nowMax = currentDateTimeLocalInputValue();
  if (trimmed > nowMax) {
    return 'Collection date and time cannot be after the current date and time.';
  }
  return null;
}
