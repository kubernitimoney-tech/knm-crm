import * as XLSX from 'xlsx';

import { logExportActivity } from '@/lib/activityLogsApi';

export type ExportColumn<T> = {
  label: string;
  key: keyof T | ((item: T, index: number) => unknown);
};

export type ExportLogContext = {
  module?: string;
  screen?: string;
  /** Human-readable export name, e.g. "All Leads list". */
  label?: string;
};

export type ExcelSheetData = {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
};

function cellValue(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function ensureXlsxFilename(filename: string): string {
  const trimmed = filename.trim();
  return trimmed.toLowerCase().endsWith('.xlsx') ? trimmed : `${trimmed}.xlsx`;
}

function sheetName(name: string): string {
  return name.trim().slice(0, 31) || 'Export';
}

/**
 * Shared export filename: `{prefix}_{filter}_{dd_mm_yyyy_hh_mm_ss}`
 * Example: `dashboard_current_month_06_08_2026_11_36_12`
 */
export function buildExportFilename(
  prefix: string,
  filterLabel: string,
  at: Date = new Date(),
): string {
  const prefixSlug = slugExportToken(prefix) || 'export';
  const filterSlug = slugExportToken(filterLabel) || 'all';
  const stamp = [
    String(at.getDate()).padStart(2, '0'),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getFullYear()),
    String(at.getHours()).padStart(2, '0'),
    String(at.getMinutes()).padStart(2, '0'),
    String(at.getSeconds()).padStart(2, '0'),
  ].join('_');
  return `${prefixSlug}_${filterSlug}_${stamp}`;
}

/** Map period filter UI labels to filename slugs (`all_time`, `current_month`, …). */
export function periodFilterSlug(dateFilter: string): string {
  const map: Record<string, string> = {
    'All Time': 'all_time',
    Today: 'today',
    'Last 7 Days': 'last_7_days',
    'Current Month': 'current_month',
    Custom: 'custom',
    'Custom Range': 'custom',
  };
  return map[dateFilter] ?? (slugExportToken(dateFilter) || 'all_time');
}

function slugExportToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function downloadWorkbook(
  rows: (string | number)[][],
  filename: string,
  sheetNameValue = 'Export',
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(sheetNameValue));
  XLSX.writeFile(workbook, ensureXlsxFilename(filename), { bookType: 'xlsx' });
}

/** Export tabular data as an Excel 2021-compatible .xlsx workbook. */
export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetNameValue = 'Export',
  logContext?: ExportLogContext,
): void {
  if (!data.length) return;

  const rows: (string | number)[][] = [
    columns.map((column) => column.label),
    ...data.map((item, index) =>
      columns.map((column) => {
        const raw = typeof column.key === 'function' ? column.key(item, index) : item[column.key];
        return cellValue(raw);
      }),
    ),
  ];

  downloadWorkbook(rows, filename, sheetNameValue);
  logExportActivity({
    filename,
    sheetName: sheetNameValue,
    rowCount: data.length,
    label: logContext?.label,
    module: logContext?.module,
    screen: logContext?.screen,
  });
}

/** Export pre-built header + row arrays as an Excel 2021-compatible .xlsx workbook. */
export function exportRowsToExcel(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string,
  sheetNameValue = 'Export',
  logContext?: ExportLogContext,
): void {
  if (!rows.length) return;

  downloadWorkbook(
    [headers, ...rows.map((row) => row.map((cell) => cellValue(cell)))],
    filename,
    sheetNameValue,
  );
  logExportActivity({
    filename,
    sheetName: sheetNameValue,
    rowCount: rows.length,
    label: logContext?.label,
    module: logContext?.module,
    screen: logContext?.screen,
  });
}

/** Multi-sheet .xlsx (headers included even when a sheet has no data rows). */
export function exportMultiSheetToExcel(
  sheets: ExcelSheetData[],
  filename: string,
  logContext?: ExportLogContext,
): void {
  if (!sheets.length) return;

  const workbook = XLSX.utils.book_new();
  let totalRows = 0;
  const usedNames = new Set<string>();

  sheets.forEach((sheet, index) => {
    let name = sheetName(sheet.name);
    if (usedNames.has(name)) {
      name = sheetName(`${name}_${index + 1}`);
    }
    usedNames.add(name);

    const aoa: (string | number)[][] = [
      sheet.headers,
      ...sheet.rows.map((row) => row.map((cell) => cellValue(cell))),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
    totalRows += sheet.rows.length;
  });

  XLSX.writeFile(workbook, ensureXlsxFilename(filename), { bookType: 'xlsx' });
  logExportActivity({
    filename,
    sheetName: sheets.map((s) => s.name).join(', '),
    rowCount: totalRows,
    label: logContext?.label,
    module: logContext?.module,
    screen: logContext?.screen,
  });
}
