import { memo, useMemo } from 'react';
import { DayPicker, DayButton, type DateRange, type DayButtonProps, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';
import {
  getMaxToDateForFrom,
  getMinFromDate,
  getToday,
  stripTime,
  toIsoDate,
} from '@/lib/dateUtils';

export interface CalendarAvailabilityOptions {
  /** When true, Sundays cannot be selected. */
  disableSundays?: boolean;
  /** ISO date (yyyy-MM-dd) -> label shown on hover (e.g. bank holiday name). */
  holidayLabelsByIsoDate?: Record<string, string>;
}

const calendarClassNames = {
  root: 'rdp-root p-2',
  months: 'flex flex-col sm:flex-row gap-3',
  month: 'space-y-2',
  month_caption: 'flex items-center justify-center gap-1 px-1',
  caption_label: 'text-xs font-bold text-slate-700 dark:text-slate-200',
  dropdowns: 'flex items-center gap-1.5',
  dropdown_root: 'relative inline-flex items-center',
  /** Invisible overlay — visual styling belongs on caption_label (see SingleDateCalendar). */
  dropdown: 'rdp-dropdown',
  nav: 'flex items-center gap-1',
  button_previous:
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  button_next:
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'w-9 p-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-center',
  week: '',
  day: 'relative w-9 p-0 text-center align-middle',
  day_button:
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-deep/30 dark:text-slate-200 dark:hover:bg-slate-800',
  selected:
    '[&>button]:bg-primary-deep [&>button]:text-white [&>button]:hover:bg-primary-deep/90 dark:[&>button]:bg-secondary-dark',
  today: '[&>button]:font-black [&>button]:text-primary-deep dark:[&>button]:text-secondary-dark',
  outside: '[&>button]:text-slate-300 dark:[&>button]:text-slate-600',
  disabled: '[&>button]:text-slate-300 [&>button]:opacity-50 dark:[&>button]:text-slate-600',
  range_start: '[&>button]:rounded-r-none',
  range_end: '[&>button]:rounded-l-none',
  range_middle: '[&>button]:rounded-none [&>button]:bg-primary-deep/10 dark:[&>button]:bg-secondary-dark/20',
} as const;

function buildDisabledMatcher(
  minDate?: Date,
  maxDate?: Date,
  availability?: CalendarAvailabilityOptions,
): Matcher | undefined {
  const holidayLabels = availability?.holidayLabelsByIsoDate ?? {};
  const holidayIsoDates = new Set(Object.keys(holidayLabels));
  const hasBounds = Boolean(minDate || maxDate);
  const hasAvailability = Boolean(availability?.disableSundays || holidayIsoDates.size > 0);

  if (!hasBounds && !hasAvailability) return undefined;

  return (date: Date) => {
    const day = stripTime(date);
    if (minDate && day < stripTime(minDate)) return true;
    if (maxDate && day > stripTime(maxDate)) return true;
    if (availability?.disableSundays && day.getDay() === 0) return true;
    if (holidayIsoDates.has(toIsoDate(day))) {
      return true;
    }
    return false;
  };
}

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function createHolidayAwareDayButton(
  holidayLabelsByIsoDate: Record<string, string>,
  disableSundays?: boolean,
) {
  const blockedDayButtonClass =
    '!text-red-400/90 !opacity-100 cursor-not-allowed bg-red-50/90 hover:!bg-red-100/80 hover:!text-red-400/90 dark:!text-red-400/70 dark:bg-red-950/25 dark:hover:!bg-red-950/35 dark:hover:!text-red-400/70';

  return function HolidayAwareDayButton(props: DayButtonProps) {
    const holidayName = holidayLabelsByIsoDate[props.day.isoDate];
    const isSunday = Boolean(disableSundays && props.day.date.getDay() === 0);
    const isBlocked = Boolean(holidayName) || isSunday;

    let title = holidayName;
    if (!title && isSunday) {
      title = 'Sunday';
    }

    return (
      <DayButton
        {...props}
        title={title}
        className={cn(props.className, isBlocked && blockedDayButtonClass)}
      />
    );
  };
}

function buildRangeDisabledMatcher(from?: Date, to?: Date, today: Date = getToday()): Matcher {
  const todayDate = stripTime(today);
  const fromDate = from ? stripTime(from) : undefined;
  const toDate = to ? stripTime(to) : undefined;
  const awaitingToDate = Boolean(fromDate && !toDate);
  const awaitingFromDate = Boolean(toDate && !fromDate);

  return (date: Date) => {
    const day = stripTime(date);
    if (day > todayDate) return true;

    if (awaitingToDate && fromDate) {
      const maxToByYear = getMaxToDateForFrom(fromDate);
      const maxTo = maxToByYear > todayDate ? todayDate : maxToByYear;
      return day < fromDate || day > maxTo;
    }

    if (awaitingFromDate && toDate) {
      const minFrom = getMinFromDate(toDate);
      return day < minFrom || day > toDate;
    }

    return false;
  };
}

export interface SingleDateCalendarProps {
  selected?: Date;
  defaultMonth?: Date;
  minDate?: Date;
  maxDate?: Date;
  startMonth?: Date;
  endMonth?: Date;
  captionLayout?: 'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years';
  /** When true with min/max dates, month navigation stays inside the allowed months. */
  boundedRange?: boolean;
  availability?: CalendarAvailabilityOptions;
  onSelect: (date: Date | undefined) => void;
}

export const SingleDateCalendar = memo(function SingleDateCalendar({
  selected,
  defaultMonth,
  minDate,
  maxDate,
  startMonth,
  endMonth,
  captionLayout = 'label',
  boundedRange = false,
  availability,
  onSelect,
}: SingleDateCalendarProps) {
  const isBoundedRange = boundedRange && Boolean(minDate && maxDate);
  const resolvedStartMonth = startMonth ?? (isBoundedRange && minDate ? monthStart(minDate) : undefined);
  const resolvedEndMonth = endMonth ?? (isBoundedRange && maxDate ? monthStart(maxDate) : undefined);
  const resolvedCaptionLayout = isBoundedRange ? 'label' : captionLayout;

  const disabled = useMemo(
    () => buildDisabledMatcher(minDate, maxDate, availability),
    [minDate, maxDate, availability],
  );
  const holidayLabelsByIsoDate = availability?.holidayLabelsByIsoDate ?? {};
  const disableSundays = availability?.disableSundays ?? false;
  const DayButtonComponent = useMemo(
    () => createHolidayAwareDayButton(holidayLabelsByIsoDate, disableSundays),
    [holidayLabelsByIsoDate, disableSundays],
  );
  const components = useMemo(() => {
    if (!disableSundays && Object.keys(holidayLabelsByIsoDate).length === 0) {
      return undefined;
    }
    return { DayButton: DayButtonComponent };
  }, [DayButtonComponent, disableSundays, holidayLabelsByIsoDate]);
  const classNames = useMemo(() => {
    const usesDropdownCaption =
      resolvedCaptionLayout === 'dropdown' ||
      resolvedCaptionLayout === 'dropdown-months' ||
      resolvedCaptionLayout === 'dropdown-years';

    if (!usesDropdownCaption) {
      return calendarClassNames;
    }

    return {
      ...calendarClassNames,
      caption_label: cn(
        'rdp-caption_label inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
      ),
    };
  }, [resolvedCaptionLayout]);

  return (
    <DayPicker
      mode="single"
      animate={false}
      showOutsideDays={!isBoundedRange}
      fixedWeeks={false}
      selected={selected}
      defaultMonth={defaultMonth ?? selected}
      startMonth={resolvedStartMonth}
      endMonth={resolvedEndMonth}
      captionLayout={resolvedCaptionLayout}
      disabled={disabled}
      components={components}
      onSelect={onSelect}
      classNames={classNames}
      className={cn('bg-white dark:bg-slate-900')}
    />
  );
});

export interface RangeDateCalendarProps {
  from?: Date;
  to?: Date;
  defaultMonth?: Date;
  onSelect: (range: DateRange | undefined) => void;
}

export const RangeDateCalendar = memo(function RangeDateCalendar({
  from,
  to,
  defaultMonth,
  onSelect,
}: RangeDateCalendarProps) {
  const selected = useMemo(() => ({ from, to }), [from, to]);
  const disabled = useMemo(() => buildRangeDisabledMatcher(from, to), [from, to]);

  return (
    <DayPicker
      mode="range"
      animate={false}
      showOutsideDays
      numberOfMonths={2}
      pagedNavigation
      min={1}
      resetOnSelect
      selected={selected}
      defaultMonth={defaultMonth ?? from ?? to}
      disabled={disabled}
      onSelect={onSelect}
      classNames={calendarClassNames}
      className={cn('bg-white p-2 dark:bg-slate-900')}
    />
  );
});
