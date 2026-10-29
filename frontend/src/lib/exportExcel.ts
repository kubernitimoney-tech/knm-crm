import ExcelJS from 'exceljs';

import { logExportActivity } from '@/lib/activityLogsApi';
import { APP_TIMEZONE } from '@/lib/dateUtils';

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
  rows: (string | number | boolean | Date | null | undefined)[][];
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2A2D4F' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  name: 'Calibri',
  size: 11,
};
const TEXT_PLACEHOLDERS = new Set(['', '—', '–', '-', 'n/a', 'na', 'null', 'undefined', 'nan']);
const EXCEL_FMT = {
  integer: '0',
  decimal: '0.00',
  percent: '0.00%',
  date: 'dd-mm-yyyy',
  datetime: 'dd-mm-yyyy hh:mm AM/PM',
  text: '@',
} as const;

type CoercedCell = {
  value: string | number | Date | boolean;
  numFmt?: string;
};

function ensureXlsxFilename(filename: string): string {
  const trimmed = filename.trim();
  return trimmed.toLowerCase().endsWith('.xlsx') ? trimmed : `${trimmed}.xlsx`;
}

function sheetTitle(name: string): string {
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

function numberCell(value: number): CoercedCell {
  if (Number.isInteger(value)) {
    return { value, numFmt: EXCEL_FMT.integer };
  }
  return { value, numFmt: EXCEL_FMT.decimal };
}

/**
 * ExcelJS serialises a Date from its UTC instant, so local midnight in IST would land on the
 * previous day. Build the cell from wall-clock parts as UTC so Excel shows them unchanged.
 */
function dateCell(
  year: number,
  month: number,
  day: number,
  time: { hour: number; minute: number; second: number } | null,
): CoercedCell {
  const value = new Date(
    Date.UTC(year, month - 1, day, time?.hour ?? 0, time?.minute ?? 0, time?.second ?? 0),
  );
  return { value, numFmt: time ? EXCEL_FMT.datetime : EXCEL_FMT.date };
}

/** Date instant → cell showing its wall-clock time in the app timezone. */
function instantCell(date: Date, allowDateOnly: boolean): CoercedCell {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const time = { hour: pick('hour') % 24, minute: pick('minute'), second: pick('second') };
  const isMidnight = time.hour === 0 && time.minute === 0 && time.second === 0;
  return dateCell(pick('year'), pick('month'), pick('day'), allowDateOnly && isMidnight ? null : time);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isIdentifierText(raw: string): boolean {
  const compact = raw.replace(/[\s-]/g, '');
  if (!compact) return false;
  if (/^0+\d+$/.test(compact)) return true;
  if (/^\d{10,}$/.test(compact)) return true;
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(compact)) return true;
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(compact)) return true;
  return false;
}

function parseLocaleNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/^(inr|rs\.?|₹)/i, '');
  if (!cleaned || cleaned === '-' || cleaned === '+' || cleaned === '.') return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseExportDate(raw: string): CoercedCell | null {
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [year, month, day] = [Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])];
    if (isValidCalendarDate(year, month, day)) return dateCell(year, month, day, null);
  }

  const isoDateTime = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  );
  if (isoDateTime) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return instantCell(parsed, false);
  }

  const appDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (appDate) {
    const [year, month, day] = [Number(appDate[3]), Number(appDate[2]), Number(appDate[1])];
    if (isValidCalendarDate(year, month, day)) return dateCell(year, month, day, null);
  }

  const appDateTime = raw.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );
  if (appDateTime) {
    let hour = Number(appDateTime[4]);
    const minute = Number(appDateTime[5]);
    const second = appDateTime[6] ? Number(appDateTime[6]) : 0;
    const period = appDateTime[7].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const [year, month, day] = [Number(appDateTime[3]), Number(appDateTime[2]), Number(appDateTime[1])];
    if (isValidCalendarDate(year, month, day) && hour < 24 && minute < 60 && second < 60) {
      return dateCell(year, month, day, { hour, minute, second });
    }
  }

  return null;
}

/** Coerce a JS value into an Excel-typed cell (number / date / datetime / general text). */
export function coerceExportCell(raw: unknown): CoercedCell | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return instantCell(raw, true);
  }
  if (typeof raw === 'boolean') return { value: raw ? 'Yes' : 'No', numFmt: EXCEL_FMT.text };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return numberCell(raw);
  }
  if (typeof raw !== 'string') return { value: String(raw), numFmt: EXCEL_FMT.text };

  const trimmed = raw.trim();
  if (TEXT_PLACEHOLDERS.has(trimmed.toLowerCase()) || TEXT_PLACEHOLDERS.has(trimmed)) {
    return null;
  }

  const percent = trimmed.match(/^(-?[\d,]+\.?\d*)\s*%$/);
  if (percent) {
    const value = parseLocaleNumber(percent[1]);
    if (value !== null) return { value: value / 100, numFmt: EXCEL_FMT.percent };
  }

  const parsedDate = parseExportDate(trimmed);
  if (parsedDate) return parsedDate;

  if (!isIdentifierText(trimmed)) {
    const numeric = parseLocaleNumber(trimmed);
    if (numeric !== null) return numberCell(numeric);
  }

  return { value: trimmed, numFmt: EXCEL_FMT.text };
}

function columnWidth(value: unknown): number {
  const length = String(value ?? '').length;
  return Math.min(40, Math.max(12, length + 2));
}

function addWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number | boolean | Date | null | undefined)[][],
  usedNames: Set<string>,
  index: number,
): void {
  let title = sheetTitle(name);
  if (usedNames.has(title)) {
    title = sheetTitle(`${title}_${index + 1}`);
  }
  usedNames.add(title);

  const worksheet = workbook.addWorksheet(title, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const colCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const widths = Array.from({ length: colCount }, (_, col) => columnWidth(headers[col]));

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  rows.forEach((row) => {
    const excelRow = worksheet.addRow(new Array(colCount).fill(null));
    for (let c = 0; c < colCount; c += 1) {
      const typed = coerceExportCell(row[c]);
      if (!typed) continue;
      const cell = excelRow.getCell(c + 1);
      cell.value = typed.value;
      if (typed.numFmt) cell.numFmt = typed.numFmt;
      widths[c] = Math.max(widths[c], columnWidth(typed.value instanceof Date ? headers[c] : typed.value));
    }
  });

  widths.forEach((wch, index) => {
    worksheet.getColumn(index + 1).width = wch;
  });
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

async function downloadWorkbook(
  sheets: ExcelSheetData[],
  filename: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kuberniti LMS';
  const usedNames = new Set<string>();
  sheets.forEach((sheet, index) => {
    addWorksheet(workbook, sheet.name, sheet.headers, sheet.rows, usedNames, index);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = ensureXlsxFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function startDownload(
  sheets: ExcelSheetData[],
  filename: string,
  logContext?: ExportLogContext,
  rowCount = 0,
): void {
  void downloadWorkbook(sheets, filename).then(() => {
    logExportActivity({
      filename,
      sheetName: sheets.map((sheet) => sheet.name).join(', '),
      rowCount,
      label: logContext?.label,
      module: logContext?.module,
      screen: logContext?.screen,
    });
  });
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

  const headers = columns.map((column) => column.label);
  const rows = data.map((item, index) =>
    columns.map((column) =>
      typeof column.key === 'function' ? column.key(item, index) : item[column.key],
    ),
  );

  startDownload([{ name: sheetNameValue, headers, rows }], filename, logContext, data.length);
}

/** Export pre-built header + row arrays as an Excel 2021-compatible .xlsx workbook. */
export function exportRowsToExcel(
  headers: string[],
  rows: (string | number | boolean | Date | null | undefined)[][],
  filename: string,
  sheetNameValue = 'Export',
  logContext?: ExportLogContext,
): void {
  if (!rows.length) return;

  startDownload([{ name: sheetNameValue, headers, rows }], filename, logContext, rows.length);
}

/** Multi-sheet .xlsx (headers included even when a sheet has no data rows). */
export function exportMultiSheetToExcel(
  sheets: ExcelSheetData[],
  filename: string,
  logContext?: ExportLogContext,
): void {
  if (!sheets.length) return;

  startDownload(
    sheets,
    filename,
    logContext,
    sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
  );
}
