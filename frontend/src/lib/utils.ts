import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { exportToExcel, type ExportColumn } from '@/lib/exportExcel';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: number | string | null | undefined): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(value);
}

export function formatCurrency(amount: number | string | null | undefined) {
  return formatAmount(amount);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/** Format ROI / rate values for display (always 2 decimal places, no suffix). */
export function formatRate(value: number | string | null | undefined, fractionDigits = 2): string {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(parsed)) {
    return (0).toFixed(fractionDigits);
  }
  return parsed.toFixed(fractionDigits);
}

/** Format ROI / rate values with a percent suffix (e.g. 0.50%). */
export function formatRatePercent(value: number | string | null | undefined): string {
  return `${formatRate(value)}%`;
}

const PERSON_NAME_PLACEHOLDERS = new Set(['—', '-', 'n/a', 'na']);

/** Title-case person names for table display (e.g. "pankaj kumar" → "Pankaj Kumar"). */
export function formatPersonName(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '—';
  if (PERSON_NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) return trimmed;

  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          if (!part) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('-'),
    )
    .join(' ');
}

export type { ExportColumn } from '@/lib/exportExcel';
export {
  exportRowsToExcel,
  exportToExcel,
  exportMultiSheetToExcel,
  buildExportFilename,
  periodFilterSlug,
} from '@/lib/exportExcel';

/** @deprecated Use exportToExcel — kept for existing call sites. */
export function exportToCSV<T>(
  data: T[],
  headers: ExportColumn<T>[],
  filename: string,
) {
  exportToExcel(data, headers, filename);
}
