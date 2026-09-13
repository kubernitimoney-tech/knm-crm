import { useEffect, useMemo, useState } from 'react';
import {
  getDayOptions,
  getMonthOptions,
  getYearOptions,
  maxBirthYear,
  minBirthYear,
  parseIsoDate,
  toIsoDate,
} from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
interface DateOfBirthPickerProps {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DateOfBirthPicker({
  value = '',
  onChange,
  onBlur,
  disabled = false,
  className,
  id = 'dob',
}: DateOfBirthPickerProps) {
  const parsed = parseIsoDate(value);
  const [day, setDay] = useState(parsed?.getDate() ?? 0);
  const [month, setMonth] = useState(parsed ? parsed.getMonth() + 1 : 0);
  const [year, setYear] = useState(parsed?.getFullYear() ?? 0);

  useEffect(() => {
    const next = parseIsoDate(value);
    setDay(next?.getDate() ?? 0);
    setMonth(next ? next.getMonth() + 1 : 0);
    setYear(next?.getFullYear() ?? 0);
  }, [value]);

  const fromYear = minBirthYear();
  const toYear = maxBirthYear();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(fromYear, toYear), [fromYear, toYear]);
  const dayOptions = useMemo(
    () => (year && month ? getDayOptions(year, month) : []),
    [year, month],
  );

  const emitChange = (nextDay: number, nextMonth: number, nextYear: number) => {
    if (!nextDay || !nextMonth || !nextYear) {
      onChange('');
      return;
    }
    onChange(toIsoDate(nextYear, nextMonth, nextDay));
  };

  const handleDayChange = (nextDay: number) => {
    setDay(nextDay);
    emitChange(nextDay, month, year);
  };

  const handleMonthChange = (nextMonth: number) => {
    setMonth(nextMonth);
    let nextDay = day;
    if (year && nextMonth && day) {
      const maxDay = getDayOptions(year, nextMonth).length;
      if (day > maxDay) {
        nextDay = maxDay;
        setDay(maxDay);
      }
    }
    emitChange(nextDay, nextMonth, year);
  };

  const handleYearChange = (nextYear: number) => {
    setYear(nextYear);
    let nextDay = day;
    if (nextYear && month && day) {
      const maxDay = getDayOptions(nextYear, month).length;
      if (day > maxDay) {
        nextDay = maxDay;
        setDay(maxDay);
      }
    }
    emitChange(nextDay, month, nextYear);
  };

  return (
    <div className={cn(className)}>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby={`${id}-label`}>
        <label htmlFor={`${id}-day`} className="sr-only">
          Day of birth
        </label>
        <select
          id={`${id}-day`}
          className="input-field"
          value={day || ''}
          disabled={disabled || !month || !year}
          onBlur={onBlur}
          onChange={(event) => handleDayChange(Number(event.target.value))}
        >
          <option value="">Day</option>
          {dayOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-month`} className="sr-only">
          Month of birth
        </label>
        <select
          id={`${id}-month`}
          className="input-field"
          value={month || ''}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) => handleMonthChange(Number(event.target.value))}
        >
          <option value="">Month</option>
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-year`} className="sr-only">
          Year of birth
        </label>
        <select
          id={`${id}-year`}
          className="input-field"
          value={year || ''}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) => handleYearChange(Number(event.target.value))}
        >
          <option value="">Year</option>
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
