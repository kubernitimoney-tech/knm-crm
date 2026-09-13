export type DashboardDateFilter =
  | 'All Time'
  | 'Today'
  | 'Last 7 Days'
  | 'Current Month'
  | 'Custom';

export interface DashboardDateRange {
  from?: Date;
  to?: Date;
}

export function getDashboardPeriodLabel(
  dateFilter: DashboardDateFilter,
  dateRange: DashboardDateRange,
): string {
  if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
    return 'Custom Range';
  }
  return dateFilter;
}

/** Slug used in export filenames, e.g. `current_month`, `last_7_days`. */
export function getDashboardExportFilterSlug(
  dateFilter: DashboardDateFilter,
  dateRange: DashboardDateRange,
): string {
  if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
    return 'custom';
  }
  const map: Record<DashboardDateFilter, string> = {
    'All Time': 'all_time',
    Today: 'today',
    'Last 7 Days': 'last_7_days',
    'Current Month': 'current_month',
    Custom: 'custom',
  };
  return map[dateFilter] ?? 'current_month';
}
