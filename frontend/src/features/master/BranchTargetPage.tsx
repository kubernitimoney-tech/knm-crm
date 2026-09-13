import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  ChevronLeft,
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ui/ExportButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import {
  DataTablePrimaryCell,
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableActionCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableSortableHeadClass,
  indexCellClass,
  nameCellClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  dataTablePrimaryActionButtonClass,
  dataTableFilterControlClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import {
  DataTableListingActions,
  DataTableActionHead,
  useDataTableActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { format, subMonths } from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BranchTargetFormDialog } from './components/BranchTargetFormDialog';
import {
  MONTH_OPTIONS,
  deleteBranchTarget,
  fetchBranchTargets,
  formatTargetPeriod,
  type BranchTarget,
} from '@/lib/branchTargetsApi';
import { exportRowsToExcel, formatCurrency, cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

type PeriodFilter =
  | 'Current Month'
  | 'Previous Month'
  | 'Custom';

const PERIOD_FILTER_OPTIONS: PeriodFilter[] = [
  'Current Month',
  'Previous Month',
  'Custom',
];

const DEFAULT_PERIOD_FILTER: PeriodFilter = 'Current Month';

/** Custom year dropdown range for branch target filters */
const FILTER_YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => 2026 + i);

function monthFilterLabel(month: number | null): string {
  if (month == null) return '';
  return MONTH_OPTIONS.find((item) => item.value === month)?.label ?? String(month);
}

/** Multi-period style order: branch A–Z, then month (Jan→Dec), then year. */
const PERIOD_GROUP_SORT_FILTERS: PeriodFilter[] = ['Custom'];

function compareBranchThenMonthThenYear(a: BranchTarget, b: BranchTarget): number {
  const byBranch = a.branchName.localeCompare(b.branchName, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  if (byBranch !== 0) return byBranch;
  if (a.periodMonth !== b.periodMonth) return a.periodMonth - b.periodMonth;
  if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
  return 0;
}

function matchesPeriodFilter(
  target: BranchTarget,
  filter: PeriodFilter,
  customYear: number | null,
  customMonth: number | null,
): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (filter === 'Current Month') {
    return target.periodYear === currentYear && target.periodMonth === currentMonth;
  }

  if (filter === 'Previous Month') {
    const previous = subMonths(now, 1);
    return (
      target.periodYear === previous.getFullYear()
      && target.periodMonth === previous.getMonth() + 1
    );
  }

  if (filter === 'Custom') {
    if (customYear == null || customMonth == null) return true;
    return target.periodYear === customYear && target.periodMonth === customMonth;
  }

  return true;
}

export const BranchTargetPage = () => {
  useTitle('Branch Targets');
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const actionCol = useDataTableActionColumn({ edit: isSuperAdmin, delete: isSuperAdmin });
  const tableColSpan = actionCol.showColumn ? 6 : 5;

  const [targets, setTargets] = useState<BranchTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(DEFAULT_PERIOD_FILTER);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const [customMonth, setCustomMonth] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'branchName',
    direction: 'asc',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<BranchTarget | null>(null);

  const loadTargets = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchBranchTargets();
      setTargets(data);
    } catch (err) {
      setTargets([]);
      setLoadError(err instanceof Error ? err.message : 'Failed to load branch targets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const hasActiveFilters =
    searchQuery !== ''
    || periodFilter !== DEFAULT_PERIOD_FILTER
    || customYear != null
    || customMonth != null;

  const handleClearFilters = () => {
    setSearchQuery('');
    setPeriodFilter(DEFAULT_PERIOD_FILTER);
    setCustomYear(null);
    setCustomMonth(null);
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={12} className="ml-1 text-primary-deep" />
    ) : (
      <ArrowDown size={12} className="ml-1 text-primary-deep" />
    );
  };

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const numericQuery = query.replace(/[₹,\s]/g, '');

    const result = [...targets].filter((t) => {
      let matchesSearch = true;
      if (query) {
        const byName = t.branchName.toLowerCase().includes(query);
        const targetRaw = String(t.target);
        const byAmount =
          targetRaw.toLowerCase().includes(query)
          || (numericQuery !== '' && targetRaw.includes(numericQuery))
          || formatCurrency(t.target).toLowerCase().includes(query);
        matchesSearch = byName || byAmount;
      }

      const matchesPeriod = matchesPeriodFilter(t, periodFilter, customYear, customMonth);
      return matchesSearch && matchesPeriod;
    });

    if (PERIOD_GROUP_SORT_FILTERS.includes(periodFilter)) {
      // Branch → Month (Jan, Feb, …) → Year (e.g. Jan 2024, Jan 2025, Feb 2024, …)
      result.sort(compareBranchThenMonthThenYear);
      return result;
    }

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof BranchTarget];
        const bVal = b[sortConfig.key as keyof BranchTarget];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [targets, searchQuery, periodFilter, customYear, customMonth, sortConfig]);

  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleExport = () => {
    const headers = ['S.No', 'Branch Name', 'Period', 'Monthly Target', 'Added On'];
    const data = filteredAndSorted.map((t, index) => [
      index + 1,
      t.branchName,
      formatTargetPeriod(t.periodYear, t.periodMonth),
      t.target,
      format(new Date(t.addedOn), 'yyyy-MM-dd'),
    ]);

    exportRowsToExcel(headers, data, `branch_targets_export_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const openCreateForm = () => {
    setEditingTarget(null);
    setFormOpen(true);
  };

  const openEditForm = (target: BranchTarget) => {
    setEditingTarget(target);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary-deep hover:bg-slate-100"
              onClick={() => navigate('/master/category')}
            >
              <ChevronLeft size={24} />
            </Button>
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Branch Targets</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && <ExportButton onClick={handleExport} />}
          <Button
            size="sm"
            onClick={openCreateForm}
            className={dataTablePrimaryActionButtonClass}
          >
            <Plus className="w-4 h-4 mr-1" />
            Define Target
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {loadError}
        </div>
      )}

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Branch Name', 'Target Amount')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select
              value={periodFilter}
              onValueChange={(val) => {
                const next = (val as PeriodFilter) ?? DEFAULT_PERIOD_FILTER;
                setPeriodFilter(next);
                if (next !== 'Custom') {
                  setCustomYear(null);
                  setCustomMonth(null);
                } else if (customYear == null || customMonth == null) {
                  const now = new Date();
                  setCustomYear(now.getFullYear());
                  setCustomMonth(now.getMonth() + 1);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className={cn('w-[150px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Period')} />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {periodFilter === 'Custom' && (
              <>
                <Select
                  value={customMonth != null ? String(customMonth) : null}
                  onValueChange={(val) => {
                    setCustomMonth(val ? Number(val) : null);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className={cn('w-[140px]', dataTableFilterControlClass)}>
                    <SelectValue placeholder={selectPlaceholder('Month')}>
                      {monthFilterLabel(customMonth) || undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)} label={month.label}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={customYear != null ? String(customYear) : null}
                  onValueChange={(val) => {
                    setCustomYear(val ? Number(val) : null);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className={cn('w-[100px]', dataTableFilterControlClass)}>
                    <SelectValue placeholder={selectPlaceholder('Year')}>
                      {customYear != null ? String(customYear) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_YEAR_OPTIONS.map((year) => (
                      <SelectItem key={year} value={String(year)} label={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {hasActiveFilters && (
              <DataTableClearFiltersButton onClick={handleClearFilters} />
            )}
          </div>
        </div>

        <Card className={dataTableCardClass}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dataTableHeadClass, 'w-[80px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('branchName')}>
                  <div className="flex items-center">Branch Name {getSortIcon('branchName')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('periodYear')}>
                  <div className="flex items-center">Target Period {getSortIcon('periodYear')}</div>
                </TableHead>
                <TableHead className={cn(dataTableSortableHeadClass, 'text-right')} onClick={() => handleSort('target')}>
                  <div className="flex items-center justify-end">Monthly Target {getSortIcon('target')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('addedOn')}>
                  <div className="flex items-center">Added On {getSortIcon('addedOn')}</div>
                </TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading branch targets…" />
              ) : paginated.length > 0 ? (
                paginated.map((item, idx) => (
                  <TableRow key={item.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <div className="flex flex-col gap-0.5">
                        <DataTablePrimaryCell label={item.branchName} tone="neutral" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                          {item.branchBank}
                          {item.branchCity ? ` · ${item.branchCity}` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {formatTargetPeriod(item.periodYear, item.periodMonth)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {formatCurrency(item.target)}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {formatAppDateTimeOrFallback(item.addedOn)}
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        onEdit={() => openEditForm(item)}
                        onDelete={async () => {
                          await deleteBranchTarget(item.id);
                          await loadTargets();
                        }}
                        deleteTitle="Delete branch target?"
                        deleteDescription={`This will permanently delete the target for ${item.branchName} (${formatTargetPeriod(item.periodYear, item.periodMonth)}).`}
                        deleteConfirmLabel="Delete target"
                      />
                    </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-[300px] text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                        <Search size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900 tracking-tight">
                          No branch targets found
                        </p>
                        <p className="text-xs text-slate-400 font-medium">
                          Define a target or adjust your filters
                        </p>
                      </div>
                      {!hasActiveFilters && (
                        <Button
                          size="sm"
                          onClick={openCreateForm}
                          className={cn(dataTablePrimaryActionButtonClass, 'mt-2')}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Define Target
                        </Button>
                      )}
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          onClick={handleClearFilters}
                          className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase tracking-widest px-4 hover:bg-slate-50 mt-2"
                        >
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        </Card>

        <DataTableFooter
          inset={false}
          currentPage={currentPage}
          totalItems={filteredAndSorted.length}
          pageSize={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo(0, 0);
          }}
          leftExtra={
            <DataTablePageSizeSelect
              value={itemsPerPage}
              onChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          }
        />
      </div>

      <BranchTargetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingTarget={editingTarget}
        onSaved={loadTargets}
      />
    </div>
  );
};
