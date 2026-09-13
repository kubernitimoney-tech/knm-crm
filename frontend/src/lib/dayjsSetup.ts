import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { APP_TIMEZONE } from '@/lib/dateUtils';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(APP_TIMEZONE);

/** Combine a calendar date (YYYY-MM-DD) with the current clock time in IST. */
export function combineAppDateWithCurrentTime(dateIso: string): string {
  const trimmed = dateIso.trim();
  if (!trimmed) return '';
  const now = dayjs().tz(APP_TIMEZONE);
  return dayjs
    .tz(trimmed, 'YYYY-MM-DD', APP_TIMEZONE)
    .hour(now.hour())
    .minute(now.minute())
    .second(now.second())
    .millisecond(0)
    .format();
}

export default dayjs;
