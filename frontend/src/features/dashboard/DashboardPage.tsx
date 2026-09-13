import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTitle } from '../../hooks/useTitle';
import { format, subMonths } from 'date-fns';
import {
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Inbox,
  Orbit,
  X,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { ExportButton } from '../../components/ui/ExportButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import { DateRangePicker } from '@/components/ui/date-picker';
import {
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableFilterControlClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableWrapperClass,
  indexCellClass,
  nameCellClass,
  tableFontClass,
} from '@/components/ui/data-table';
import { BranchMetric, Sanction, SanctionFreshRepeat } from '../../types';
import { formatCurrency, formatAmount, formatPercent, cn, formatPersonName } from '../../lib/utils';
import { buildExportFilename, exportMultiSheetToExcel } from '@/lib/exportExcel';
import { selectPlaceholder } from '@/lib/placeholders';
import {
  pickEmployeeMotivationLine,
} from '@/constants/employeeMotivation';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchDashboardTables } from '../../lib/dashboardApi';
import {
  type DashboardDateFilter,
  type DashboardDateRange,
  getDashboardExportFilterSlug,
  getDashboardPeriodLabel,
} from './dashboardFilterUtils';

const DASHBOARD_TABLE_PAGE_SIZE = 20;

const totalFooterRowClass =
  'border-t-2 border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-800';
const totalFooterCellClass =
  'bg-slate-100 px-4 py-2.5 text-right text-xs font-black tabular-nums text-slate-900 dark:bg-slate-800 dark:text-white';
const totalFooterLabelClass =
  'bg-slate-100 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-primary-deep dark:bg-slate-800 dark:text-slate-100';
const totalFooterMetricCellClass =
  'bg-slate-100 px-4 py-2.5 text-center dark:bg-slate-800';

function sumField<T>(rows: T[], key: keyof T): number {
  return rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
}

function achievementPercentage(achievement: number, target: number): number {
  if (target <= 0) return 0;
  return (achievement / target) * 100;
}

const dashboardTableHeaderClass = cn(
  dataTableHeaderClass,
  'dark:border-slate-700 dark:bg-slate-800/80',
);
const dashboardTableBodyRowClass = cn(
  dataTableBodyRowClass,
  'dark:border-slate-800/80 dark:bg-transparent dark:hover:bg-white/[0.03]',
);
const dashboardTableHeadClass = cn(
  dataTableHeadClass,
  'dark:text-slate-300',
);
const dashboardMetricCellClass = cn(
  dataTableCellClass,
  'font-medium text-slate-700 dark:text-slate-100',
);
const dashboardIndexCellClass = cn(indexCellClass, 'dark:text-slate-500');
const dashboardTableWrapperClass = cn(
  dataTableWrapperClass,
  'dark:[&_[data-slot=table-container]]:border-slate-800 dark:[&_[data-slot=table-container]]:bg-transparent',
);
const dashboardTableFooterClass = 'border-t-0 bg-transparent dark:bg-transparent';

const paginationButtonClass =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50/50 disabled:text-slate-300 disabled:hover:bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-600';
const paginationIconButtonClass = cn(paginationButtonClass, 'min-w-7 px-1.5');
const paginationTextButtonClass = cn(paginationButtonClass, 'px-2.5');

function DashboardTableSection({
  title,
  children,
  footer,
  className,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
        {title}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </Card>
  );
}

function DashboardPrimaryCell({
  label,
  badge,
  accentClassName = 'bg-amber-400',
}: {
  label: string;
  badge?: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className={cn('h-4 w-0.5 shrink-0 rounded-full', accentClassName)} aria-hidden />
      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{label}</span>
      {badge}
    </div>
  );
}

function achievementAccent(percentage: number) {
  if (percentage >= 90) return 'bg-emerald-400';
  if (percentage >= 70) return 'bg-amber-400';
  return 'bg-rose-400';
}

function DashboardAchievementText({ percentage }: { percentage: number }) {
  const toneClass =
    percentage >= 90
      ? 'text-emerald-600 dark:text-emerald-300'
      : percentage >= 70
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-rose-600 dark:text-rose-300';

  return (
    <span className={cn('text-xs font-black tabular-nums tracking-tight', toneClass)}>
      {formatPercent(percentage)}
    </span>
  );
}

function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-48 text-center">
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Inbox className="w-10 h-10 text-slate-200 dark:text-slate-700" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DashboardTableFooter({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div className="mx-3 mb-3 mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="shrink-0 text-xs leading-none text-slate-600 dark:text-slate-400">
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {from}-{to}
        </span>{' '}
        of <span className="font-bold text-slate-900 dark:text-slate-100">{totalItems.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={paginationIconButtonClass}
          disabled={isFirstPage}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft size={13} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={isFirstPage}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>
        <span className="min-w-[52px] px-1.5 text-center text-xs leading-none tabular-nums text-slate-800 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-slate-100">{currentPage}</span>
          <span className="mx-0.5 text-slate-500 dark:text-slate-500">/</span>
          <span>{totalPages.toLocaleString()}</span>
        </span>
        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={isLastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className={paginationIconButtonClass}
          disabled={isLastPage}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <ChevronsRight size={13} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

export const DashboardPage = () => {
  useTitle('Dashboard');
  const { user } = useAuthStore();
  const dashboardMotivation = useMemo(() => pickEmployeeMotivationLine(), []);
  const employeeFirstName = user?.first_name?.trim() || user?.full_name?.split(' ')[0] || 'team';

  const [dateFilter, setDateFilter] = useState<DashboardDateFilter>('Current Month');
  const [dateRange, setDateRange] = useState<DashboardDateRange>({
    from: undefined,
    to: undefined,
  });
  const [sanctionData, setSanctionData] = useState<Sanction[]>([]);
  const [branchData, setBranchData] = useState<BranchMetric[]>([]);
  const [sanctionFreshRepeatData, setSanctionFreshRepeatData] = useState<SanctionFreshRepeat[]>([]);
  const [periodLabel, setPeriodLabel] = useState('Current Month');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sanctionPage, setSanctionPage] = useState(1);
  const [branchPage, setBranchPage] = useState(1);

  const hasActiveFilters = dateFilter !== 'Current Month';

  const handleClearFilters = () => {
    setDateFilter('Current Month');
    setDateRange({ from: undefined, to: undefined });
  };

  const displayPeriodLabel = useMemo(() => {
    if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'LLL dd')} - ${format(dateRange.to, 'LLL dd')}`;
    }
    return periodLabel || getDashboardPeriodLabel(dateFilter, dateRange);
  }, [dateFilter, dateRange, periodLabel]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchDashboardTables(dateFilter, dateRange);
      setSanctionData(data.sanctions);
      setBranchData(data.branches);
      setSanctionFreshRepeatData(data.fresh_repeat);
      setPeriodLabel(data.period_label);
    } catch (err) {
      setSanctionData([]);
      setBranchData([]);
      setSanctionFreshRepeatData([]);
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setSanctionPage(1);
    setBranchPage(1);
  }, [dateFilter, dateRange]);

  const paginatedSanctionData = useMemo(() => {
    const start = (sanctionPage - 1) * DASHBOARD_TABLE_PAGE_SIZE;
    return sanctionData.slice(start, start + DASHBOARD_TABLE_PAGE_SIZE);
  }, [sanctionData, sanctionPage]);

  const paginatedBranchData = useMemo(() => {
    const start = (branchPage - 1) * DASHBOARD_TABLE_PAGE_SIZE;
    return branchData.slice(start, start + DASHBOARD_TABLE_PAGE_SIZE);
  }, [branchData, branchPage]);

  const sanctionTotals = useMemo(() => {
    const target = sumField(sanctionData, 'target');
    const achievement = sumField(sanctionData, 'achievement');
    const deficit = sumField(sanctionData, 'deficit');
    return {
      target,
      achievement,
      deficit,
      percentage: achievementPercentage(achievement, target),
    };
  }, [sanctionData]);

  const branchTotals = useMemo(() => {
    const target = sumField(branchData, 'target');
    const achievement = sumField(branchData, 'achievement');
    const deficit = sumField(branchData, 'deficit');
    return {
      target,
      achievement,
      deficit,
      percentage: achievementPercentage(achievement, target),
    };
  }, [branchData]);

  const freshRepeatTotals = useMemo(() => ({
    freshCases: sumField(sanctionFreshRepeatData, 'freshCases'),
    freshLoanAmount: sumField(sanctionFreshRepeatData, 'freshLoanAmount'),
    repeatCases: sumField(sanctionFreshRepeatData, 'repeatCases'),
    repeatLoanAmount: sumField(sanctionFreshRepeatData, 'repeatLoanAmount'),
    grandTotalCases: sumField(sanctionFreshRepeatData, 'grandTotalCases'),
    grandTotalAmount: sumField(sanctionFreshRepeatData, 'grandTotalAmount'),
  }), [sanctionFreshRepeatData]);

  const sectionTitle = (label: string) => (
    <>
      <Orbit size={16} className="text-primary-deep/50 shrink-0" />
      <h3 className="text-[11px] font-black text-primary-deep uppercase tracking-widest dark:text-slate-200">
        {label} ({displayPeriodLabel})
      </h3>
    </>
  );

  const handleExport = () => {
    const filterSlug = getDashboardExportFilterSlug(dateFilter, dateRange);
    const filename = buildExportFilename('dashboard', filterSlug);

    exportMultiSheetToExcel(
      [
        {
          name: 'SANCTION',
          headers: [
            'S.No',
            'Sanction Officer',
            'Target',
            'Achievement',
            '% Achievement',
            'Deficit',
          ],
          rows: sanctionData.map((row, idx) => [
            idx + 1,
            formatPersonName(row.officer),
            row.target,
            row.achievement,
            Number(row.percentage.toFixed(2)),
            row.deficit,
          ]),
        },
        {
          name: 'BRANCH',
          headers: ['S.No', 'Branch', 'Target', 'Achievement', '% Achievement', 'Deficit'],
          rows: branchData.map((row, idx) => [
            idx + 1,
            row.branch,
            row.target,
            row.achievement,
            Number(row.percentage.toFixed(2)),
            row.deficit,
          ]),
        },
        {
          name: 'Sanction_Fresh_Repeat_case',
          headers: [
            'S.No',
            'Sanction Officer',
            'Fresh Case',
            'Fresh Loan Amt.',
            'Repeat Case',
            'Repeat Loan Amt.',
            'Grand Total Case',
            'Grand Total Amt.',
          ],
          rows: sanctionFreshRepeatData.map((row, idx) => [
            idx + 1,
            formatPersonName(row.officer),
            row.freshCases,
            row.freshLoanAmount,
            row.repeatCases,
            row.repeatLoanAmount,
            row.grandTotalCases,
            row.grandTotalAmount,
          ]),
        },
      ],
      filename,
      {
        module: 'dashboard',
        screen: 'dashboard',
        label: `Dashboard (${displayPeriodLabel})`,
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
          </div>
          <h1 className="text-[22px] font-black text-primary-deep tracking-tight flex items-center gap-3 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="text-xs text-mid-shade font-medium italic">
            Comprehensive overview for {displayPeriodLabel}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 max-w-xl">
            Good to see you, {employeeFirstName}. {dashboardMotivation}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex h-11 items-center gap-2">
            <Filter size={16} className="text-slate-400 shrink-0" />
            <Select
              value={dateFilter}
              onValueChange={(val) => setDateFilter(val as DashboardDateFilter)}
            >
              <SelectTrigger className={cn('w-[160px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Period')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Time">All Time</SelectItem>
                <SelectItem value="Today">Today</SelectItem>
                <SelectItem value="Last 7 Days">Last 7 Days</SelectItem>
                <SelectItem value="Current Month">Current Month</SelectItem>
                <SelectItem value="Custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === 'Custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
              <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={setDateRange}
                defaultMonth={subMonths(new Date(), 1)}
              />
            </div>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              className="h-11 px-4 text-xs font-black text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl gap-2 animate-in fade-in zoom-in duration-300"
            >
              <X size={14} />
              Clear Filters
            </Button>
          )}

          <ExportButton
            permission="dashboard.export"
            onClick={handleExport}
            disabled={isLoading}
          />
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DashboardTableSection
          title={sectionTitle('SANCTION')}
          footer={
            <DashboardTableFooter
              currentPage={sanctionPage}
              totalItems={sanctionData.length}
              pageSize={DASHBOARD_TABLE_PAGE_SIZE}
              onPageChange={setSanctionPage}
            />
          }
        >
          <div className={dashboardTableWrapperClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'pl-0.5 pr-4')}>Sanction Officer</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Target</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Achievement</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-center')}>% Achievement</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Deficit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={6} message="Loading dashboard data…" />
              ) : sanctionData.length > 0 ? (
                paginatedSanctionData.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={dashboardTableBodyRowClass}
                  >
                    <TableCell className={dashboardIndexCellClass}>
                      {(sanctionPage - 1) * DASHBOARD_TABLE_PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DashboardPrimaryCell
                        label={formatPersonName(row.officer)}
                        accentClassName={achievementAccent(row.percentage)}
                      />
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.target)}
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.achievement)}
                    </TableCell>
                    <TableCell className={cn(tableFontClass, 'px-4 py-1.5 text-center')}>
                      <DashboardAchievementText percentage={row.percentage} />
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.deficit)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={6}
                  message="No transactional records found for this period"
                />
              )}
            </TableBody>
            {!isLoading && sanctionData.length > 0 && (
              <TableFooter className={dashboardTableFooterClass}>
                <TableRow className={totalFooterRowClass}>
                  <TableCell className={dashboardIndexCellClass} />
                  <TableCell className={totalFooterLabelClass}>Total</TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(sanctionTotals.target)}
                  </TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(sanctionTotals.achievement)}
                  </TableCell>
                  <TableCell className={totalFooterMetricCellClass}>
                    <DashboardAchievementText percentage={sanctionTotals.percentage} />
                  </TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(sanctionTotals.deficit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
          </div>
        </DashboardTableSection>

        <DashboardTableSection
          title={sectionTitle('BRANCH')}
          footer={
            <DashboardTableFooter
              currentPage={branchPage}
              totalItems={branchData.length}
              pageSize={DASHBOARD_TABLE_PAGE_SIZE}
              onPageChange={setBranchPage}
            />
          }
        >
          <div className={dashboardTableWrapperClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'pl-0.5 pr-4')}>Branch</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Target</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Achiev.</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-center')}>% Ach.</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Deficit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={6} message="Loading dashboard data…" />
              ) : branchData.length > 0 ? (
                paginatedBranchData.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={dashboardTableBodyRowClass}
                  >
                    <TableCell className={dashboardIndexCellClass}>
                      {(branchPage - 1) * DASHBOARD_TABLE_PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DashboardPrimaryCell
                        label={row.branch}
                        accentClassName={achievementAccent(row.percentage)}
                      />
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.target)}
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.achievement)}
                    </TableCell>
                    <TableCell className={cn(tableFontClass, 'px-4 py-1.5 text-center')}>
                      <DashboardAchievementText percentage={row.percentage} />
                    </TableCell>
                    <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                      {formatCurrency(row.deficit)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={6}
                  message="No branch records found for this period"
                />
              )}
            </TableBody>
            {!isLoading && branchData.length > 0 && (
              <TableFooter className={dashboardTableFooterClass}>
                <TableRow className={totalFooterRowClass}>
                  <TableCell className={dashboardIndexCellClass} />
                  <TableCell className={totalFooterLabelClass}>Total</TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(branchTotals.target)}
                  </TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(branchTotals.achievement)}
                  </TableCell>
                  <TableCell className={totalFooterMetricCellClass}>
                    <DashboardAchievementText percentage={branchTotals.percentage} />
                  </TableCell>
                  <TableCell className={totalFooterCellClass}>
                    {formatCurrency(branchTotals.deficit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
          </div>
        </DashboardTableSection>
      </div>

      <DashboardTableSection title={sectionTitle('Sanction Fresh v/s Repeat case')}>
        <div className={dashboardTableWrapperClass}>
        <Table>
          <TableHeader className={dashboardTableHeaderClass}>
            <TableRow className={dataTableHeaderRowClass}>
              <TableHead className={cn(dashboardTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'pl-0.5 pr-4')}>Sanction Officer</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Fresh Case</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Fresh Loan Amt.</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Repeat Case</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Repeat Loan Amt.</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Grand Total Case</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, 'text-right')}>Grand Total Amt.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingRow colSpan={8} message="Loading dashboard data…" />
            ) : sanctionFreshRepeatData.length > 0 ? (
              sanctionFreshRepeatData.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={dashboardTableBodyRowClass}
                >
                  <TableCell className={dashboardIndexCellClass}>{idx + 1}</TableCell>
                  <TableCell className={nameCellClass}>
                    <DashboardPrimaryCell label={formatPersonName(row.officer)} accentClassName="bg-primary-deep/60" />
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {row.freshCases.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {formatCurrency(row.freshLoanAmount)}
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {row.repeatCases.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {formatCurrency(row.repeatLoanAmount)}
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {row.grandTotalCases.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(dashboardMetricCellClass, 'text-right')}>
                    {formatCurrency(row.grandTotalAmount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow
                colSpan={8}
                message="No fresh vs repeat records found for this period"
              />
            )}
          </TableBody>
          {!isLoading && sanctionFreshRepeatData.length > 0 && (
            <TableFooter className={dashboardTableFooterClass}>
              <TableRow className={totalFooterRowClass}>
                <TableCell className={dashboardIndexCellClass} />
                <TableCell className={totalFooterLabelClass}>Total</TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatAmount(freshRepeatTotals.freshCases)}
                </TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatCurrency(freshRepeatTotals.freshLoanAmount)}
                </TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatAmount(freshRepeatTotals.repeatCases)}
                </TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatCurrency(freshRepeatTotals.repeatLoanAmount)}
                </TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatAmount(freshRepeatTotals.grandTotalCases)}
                </TableCell>
                <TableCell className={totalFooterCellClass}>
                  {formatCurrency(freshRepeatTotals.grandTotalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
        </div>
      </DashboardTableSection>
    </div>
  );
};
