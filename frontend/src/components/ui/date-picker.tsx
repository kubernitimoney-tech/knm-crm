import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  formatDisplayDate,
  formatAppDate,
  getDefaultDateRange,
  isSameCalendarDay,
  parseIsoDate,
  stripTime,
  validateDateRange,
} from '@/lib/dateUtils';
import { selectPlaceholder } from '@/lib/placeholders';
import { RangeDateCalendar, SingleDateCalendar, type CalendarAvailabilityOptions } from '@/components/ui/day-picker-calendar';

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  minDate?: Date;
  maxDate?: Date;
  /** Month shown when the calendar opens without a selected date. */
  defaultMonth?: Date;
  fromYear?: number;
  toYear?: number;
  align?: 'start' | 'center' | 'end';
  /** Raise popover above dialogs (e.g. z-[200]). */
  inDialog?: boolean;
  size?: 'sm' | 'default';
  id?: string;
  /** When set to year, month/year dropdowns are shown for faster navigation. */
  openTo?: 'year' | 'month' | 'day';
  /** Disable Sundays and/or bank holidays from the bank holiday master. */
  availability?: CalendarAvailabilityOptions;
  /** Lock calendar navigation and visible days to minDate–maxDate only. */
  boundedRange?: boolean;
}

function yearToStartMonth(year: number) {
  return new Date(year, 0, 1);
}

function yearToEndMonth(year: number) {
  return new Date(year, 11, 31);
}

function toIsoDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = selectPlaceholder('Date'),
  disabled = false,
  className,
  triggerClassName,
  minDate,
  maxDate,
  defaultMonth,
  fromYear = 1950,
  toYear = new Date().getFullYear() + 10,
  align = 'start',
  inDialog = false,
  size = 'default',
  id,
  openTo = 'day',
  availability,
  boundedRange,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(value);
  const displayLabel = selected ? formatDisplayDate(value) : null;
  const lockToBounds = boundedRange ?? Boolean(minDate && maxDate);
  const startMonth =
    lockToBounds && minDate
      ? new Date(minDate.getFullYear(), minDate.getMonth(), 1)
      : yearToStartMonth(fromYear);
  const endMonth =
    lockToBounds && maxDate
      ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
      : yearToEndMonth(toYear);
  const captionLayout = lockToBounds
    ? 'label'
    : openTo === 'year' || toYear - fromYear > 12
      ? 'dropdown'
      : 'label';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'w-full justify-start gap-2 font-semibold text-left',
          size === 'sm'
            ? 'h-8 px-2.5 rounded-lg text-xs bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800'
            : 'h-12 px-4 rounded-xl text-xs bg-slate-50/50 border-slate-200',
          !displayLabel && 'text-slate-400',
          triggerClassName,
          className,
        )}
      >
        <CalendarIcon size={size === 'sm' ? 14 : 16} className="shrink-0 opacity-70" />
        {displayLabel ?? <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-auto p-0 overflow-hidden', inDialog && 'z-[200]')}
        align={align}
      >
        {open && (
          <SingleDateCalendar
            selected={selected}
            defaultMonth={defaultMonth ?? selected ?? minDate}
            minDate={minDate}
            maxDate={maxDate}
            startMonth={startMonth}
            endMonth={endMonth}
            captionLayout={captionLayout}
            boundedRange={lockToBounds}
            availability={availability}
            onSelect={(date) => {
              if (!date) return;
              onChange(toIsoDateValue(date));
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export interface DateRangePickerProps {
  from?: Date;
  to?: Date;
  onChange: (range: { from?: Date; to?: Date }) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  defaultMonth?: Date;
  align?: 'start' | 'center' | 'end';
}

export { getDefaultDateRange };

function isCompleteRange(from?: Date, to?: Date): from is Date {
  return Boolean(from && to && !isSameCalendarDay(from, to));
}

/** Resolve which day the user clicked when DayPicker returns an ambiguous partial range. */
function extractClickedDay(
  range: { from?: Date; to?: Date },
  prevFrom?: Date,
  prevTo?: Date,
): Date | undefined {
  const nextFrom = range.from ? stripTime(range.from) : undefined;
  const nextTo = range.to ? stripTime(range.to) : undefined;

  if (nextFrom && (!prevFrom || !isSameCalendarDay(nextFrom, prevFrom))) {
    return nextFrom;
  }
  if (nextTo && (!prevTo || !isSameCalendarDay(nextTo, prevTo))) {
    return nextTo;
  }
  return nextFrom ?? nextTo;
}

/** Range filter calendar — lightweight dual-month picker, mounted only when open. */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = selectPlaceholder('Dates'),
  className,
  triggerClassName,
  defaultMonth,
  align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const lastValidRangeRef = React.useRef<{ from?: Date; to?: Date }>({ from, to });
  const defaultsAppliedRef = React.useRef(false);
  /** After opening with a complete range, the next click must start a new From date. */
  const pendingFromReselectRef = React.useRef(false);
  const rangeOnOpenRef = React.useRef<{ from?: Date; to?: Date }>({ from, to });

  React.useEffect(() => {
    if (isCompleteRange(from, to)) {
      const result = validateDateRange(from, to);
      if (result.valid) {
        lastValidRangeRef.current = { from, to };
      }
    }
  }, [from, to]);

  React.useEffect(() => {
    if (defaultsAppliedRef.current || from !== undefined || to !== undefined) return;
    defaultsAppliedRef.current = true;
    const defaults = getDefaultDateRange();
    lastValidRangeRef.current = defaults;
    onChange(defaults);
  }, [from, to, onChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      rangeOnOpenRef.current = { from, to };
      pendingFromReselectRef.current = isCompleteRange(from, to);
    } else {
      setValidationError(null);
      pendingFromReselectRef.current = false;
    }
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from && !range?.to) {
      setValidationError(null);
      onChange({ from: undefined, to: undefined });
      return;
    }

    if (pendingFromReselectRef.current) {
      const clicked = extractClickedDay(range, rangeOnOpenRef.current.from, rangeOnOpenRef.current.to);
      if (!clicked) return;
      pendingFromReselectRef.current = false;
      setValidationError(null);
      onChange({ from: clicked, to: undefined });
      return;
    }

    if (!range.from) {
      return;
    }

    const nextFrom = stripTime(range.from);
    const nextTo = range.to ? stripTime(range.to) : undefined;

    if (!nextTo || isSameCalendarDay(nextFrom, nextTo)) {
      setValidationError(null);
      onChange({ from: nextFrom, to: undefined });
      return;
    }

    const result = validateDateRange(nextFrom, nextTo);
    if (!result.valid) {
      setValidationError(result.message);
      onChange(lastValidRangeRef.current);
      return;
    }

    const nextRange = { from: nextFrom, to: nextTo };
    lastValidRangeRef.current = nextRange;
    setValidationError(null);
    onChange(nextRange);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-11 px-4 rounded-xl text-xs font-bold gap-2 bg-white border-slate-200',
          triggerClassName,
          className,
        )}
      >
        <CalendarIcon size={14} />
        {from ? (
          to ? (
            <>
              {formatAppDate(from)} - {formatAppDate(to)}
            </>
          ) : (
            formatAppDate(from)
          )
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 overflow-hidden" align={align}>
        {open && (
          <>
            <RangeDateCalendar
              from={from}
              to={to}
              defaultMonth={defaultMonth}
              onSelect={handleRangeSelect}
            />
            {validationError && (
              <p className="px-3 pb-2 text-xs font-semibold text-rose-500">{validationError}</p>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
