import React, { useMemo, useState } from 'react';
import { subDays, subMonths, startOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import {
  DataTableFilterPill,
  DataTableFooter,
  DataTablePageSizeSelect,
  DataTablePrimaryCell,
  DataTableCustomerNameCell,
  dataTableBodyRowClass,
  dataTableCardClass,
  dataTableFilterControlClass,
  dataTableFilterToolbarClass,
  dataTableFilterDividerClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableSortableHeadClass,
  dataTableStackClass,
  dataTableWrapperClass,
  indexCellClass,
  dataTableCellClass,
  dataTableActionCellClass,
  nameCellClass,
} from '@/components/ui/data-table';
import { DateRangePicker } from '@/components/ui/date-picker';
import type { Lead } from '@/types';
import { cn, formatCurrency, formatPersonName } from '@/lib/utils';
import { leadPipelineStatusBadgeClass, leadStatusBadgeClass } from '@/lib/badgeStyles';
import { LEAD_PIPELINE_STATUS_OPTIONS } from '@/lib/leadsApi';
import { leadDetailsPath, type LeadListReturnTo } from '@/lib/leadNavigation';
import { usePermissions } from '@/hooks/usePermissions';
import { DataTableListingActions, DataTableActionHead, useLeadListingActionColumn, RowTransferButton } from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';

function leadCategoryAccent(status: string) {
  if (status === 'Fresh') return 'bg-emerald-400';
  if (status === 'Reloan') return 'bg-blue-400';
  return 'bg-amber-400';
}

export interface LeadsDataTableProps {
  leads: Lead[];
  isLoading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  onTransfer?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  emptyMessage?: string;
  /** Hide Fresh / Reloan category pills (e.g. status-wise page tabs already filter). */
  hideCategoryFilters?: boolean;
  /** Hide pipeline status dropdown when the page already filters by status. */
  hidePipelineStatusFilter?: boolean;
  /** Show Fresh/Reloan category in the Status column (header stays "Status"). */
  statusColumnShowsCategory?: boolean;
  /** When true, parent supplies one page of rows and pagination totals. */
  serverSide?: boolean;
  totalCount?: number;
  currentPage?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (value: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (value: string) => void;
  dateRange?: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
  sortConfig?: { key: string; direction: 'asc' | 'desc' | null };
  onSortChange?: (key: string) => void;
  categoryCounts?: { all: number; fresh: number; reloan: number };
  onClearFilters?: () => void;
  /** Preserves All Leads vs Status-wise tab when opening lead details from this table. */
  listReturnTo?: LeadListReturnTo;
}

export function LeadsDataTable({
  leads,
  isLoading = false,
  loadError = '',
  onRetry,
  onTransfer,
  onEdit,
  onDelete,
  emptyMessage = 'No leads found matching your filters',
  hideCategoryFilters = true,
  hidePipelineStatusFilter = false,
  statusColumnShowsCategory = false,
  serverSide = false,
  totalCount = 0,
  currentPage: controlledPage,
  itemsPerPage: controlledPageSize,
  onPageChange,
  onPageSizeChange,
  searchQuery: controlledSearch = '',
  onSearchQueryChange,
  categoryFilter: controlledCategory = 'All',
  onCategoryFilterChange,
  dateFilter: controlledDateFilter = 'All Time',
  onDateFilterChange,
  dateRange: controlledDateRange = { from: undefined, to: undefined },
  onDateRangeChange,
  sortConfig: controlledSortConfig,
  onSortChange,
  categoryCounts: controlledCategoryCounts,
  onClearFilters,
  listReturnTo,
}: LeadsDataTableProps) {
  const { hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canTransfer = hasPermission('lead.assign') && (isSuperAdmin || isAdmin) && !!onTransfer;
  const actionCol = useLeadListingActionColumn({
    extra: canTransfer,
  });
  const tableColSpan = actionCol.showColumn ? 15 : 14;

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localCategoryFilter, setLocalCategoryFilter] = useState('All');
  const [localPipelineStatusFilter, setLocalPipelineStatusFilter] = useState('All');
  const [localDateFilter, setLocalDateFilter] = useState('All Time');
  const [localDateRange, setLocalDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [localItemsPerPage, setLocalItemsPerPage] = useState(10);
  const [localSortConfig, setLocalSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'createdAt',
    direction: 'desc',
  });

  /** Server-side mode: parent owns filters/pagination; client mode: filter in-memory. */
  const searchQuery = serverSide ? controlledSearch : localSearchQuery;
  const setSearchQuery = serverSide && onSearchQueryChange ? onSearchQueryChange : setLocalSearchQuery;
  const categoryFilter = serverSide ? controlledCategory : localCategoryFilter;
  const setCategoryFilter = serverSide && onCategoryFilterChange ? onCategoryFilterChange : setLocalCategoryFilter;
  const pipelineStatusFilter = localPipelineStatusFilter;
  const setPipelineStatusFilter = setLocalPipelineStatusFilter;
  const dateFilter = serverSide ? controlledDateFilter : localDateFilter;
  const setDateFilter = serverSide && onDateFilterChange ? onDateFilterChange : setLocalDateFilter;
  const dateRange = serverSide ? controlledDateRange : localDateRange;
  const setDateRange = serverSide && onDateRangeChange ? onDateRangeChange : setLocalDateRange;
  const currentPage = serverSide ? (controlledPage ?? 1) : localCurrentPage;
  const setCurrentPage = serverSide && onPageChange ? onPageChange : setLocalCurrentPage;
  const itemsPerPage = serverSide ? (controlledPageSize ?? 10) : localItemsPerPage;
  const setItemsPerPage = serverSide && onPageSizeChange ? onPageSizeChange : setLocalItemsPerPage;
  const sortConfig = serverSide && controlledSortConfig ? controlledSortConfig : localSortConfig;

  const handleSort = (key: string) => {
    if (serverSide && onSortChange) {
      onSortChange(key);
      return;
    }
    setLocalSortConfig((prev) => ({
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

  const hasActiveFilters =
    searchQuery !== '' ||
    (!hideCategoryFilters && categoryFilter !== 'All') ||
    (!hidePipelineStatusFilter && pipelineStatusFilter !== 'All') ||
    dateFilter !== 'All Time';

  const handleClearFilters = () => {
    if (serverSide && onClearFilters) {
      onClearFilters();
      return;
    }
    setSearchQuery('');
    setCategoryFilter('All');
    setPipelineStatusFilter('All');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const computedCategoryCounts = useMemo(
    () => ({
      all: serverSide ? totalCount : leads.length,
      fresh: leads.filter((lead) => lead.status === 'Fresh').length,
      reloan: leads.filter((lead) => lead.status === 'Reloan').length,
    }),
    [leads, serverSide, totalCount],
  );
  const categoryCounts = controlledCategoryCounts ?? computedCategoryCounts;

  const filteredAndSortedLeads = useMemo(() => {
    if (serverSide) return leads;
    let result = leads.filter((lead) => {
      const matchesSearch =
        lead.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobile.includes(searchQuery) ||
        lead.leadId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        hideCategoryFilters || categoryFilter === 'All' || lead.status === categoryFilter;
      const matchesPipeline =
        hidePipelineStatusFilter ||
        pipelineStatusFilter === 'All' ||
        lead.pipelineStatus === pipelineStatusFilter;

      let matchesDate = true;
      if (dateFilter !== 'All Time' && lead.createdAt) {
        const leadDate = new Date(lead.createdAt);
        const now = new Date();
        if (dateFilter === 'Today') {
          matchesDate = isWithinInterval(leadDate, {
            start: startOfDay(now),
            end: endOfDay(now),
          });
        } else if (dateFilter === 'Last 7 Days') {
          matchesDate = isWithinInterval(leadDate, {
            start: startOfDay(subDays(now, 7)),
            end: endOfDay(now),
          });
        } else if (dateFilter === 'Current Month') {
          matchesDate = isWithinInterval(leadDate, {
            start: startOfMonth(now),
            end: endOfDay(now),
          });
        } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
          matchesDate = isWithinInterval(leadDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        }
      }

      return matchesSearch && matchesCategory && matchesPipeline && matchesDate;
    });

    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof Lead] ?? '';
        const bVal = b[sortConfig.key as keyof Lead] ?? '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, searchQuery, categoryFilter, pipelineStatusFilter, dateFilter, dateRange, sortConfig, hideCategoryFilters, hidePipelineStatusFilter, serverSide]);

  const paginatedLeads = useMemo(() => {
    if (serverSide) return leads;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedLeads, currentPage, itemsPerPage, leads, serverSide]);

  const footerTotal = serverSide ? totalCount : filteredAndSortedLeads.length;

  return (
    <div className={dataTableStackClass}>
      <div className={dataTableFilterToolbarClass}>
        <div className="relative min-w-[200px] flex-1 max-w-xl">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
          <Input
            placeholder={searchPlaceholder('Name', 'Mobile', 'or Lead ID')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className={cn('pl-8 focus-visible:ring-primary-deep/10', dataTableFilterControlClass)}
          />
        </div>

        {!hideCategoryFilters && (
          <>
            <div className={dataTableFilterDividerClass} />

            <div className="flex flex-wrap items-center gap-1.5">
              <DataTableFilterPill
                label="All"
                count={categoryCounts.all}
                active={categoryFilter === 'All'}
                onClick={() => {
                  setCategoryFilter('All');
                  setCurrentPage(1);
                }}
              />
              <DataTableFilterPill
                label="Fresh"
                count={categoryCounts.fresh}
                active={categoryFilter === 'Fresh'}
                onClick={() => {
                  setCategoryFilter('Fresh');
                  setCurrentPage(1);
                }}
              />
              <DataTableFilterPill
                label="Reloan"
                count={categoryCounts.reloan}
                active={categoryFilter === 'Reloan'}
                onClick={() => {
                  setCategoryFilter('Reloan');
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {!hidePipelineStatusFilter && (
            <Select
              value={pipelineStatusFilter}
              onValueChange={(val) => {
                setPipelineStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className={cn('w-[148px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                {LEAD_PIPELINE_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={dateFilter}
            onValueChange={(val) => {
              setDateFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className={cn('w-[128px]', dataTableFilterControlClass)}>
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

          {dateFilter === 'Custom' && (
            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onChange={(range) =>
                setDateRange({
                  from: range.from ?? dateRange.from,
                  to: range.to ?? dateRange.to,
                })
              }
              defaultMonth={subMonths(new Date(), 1)}
              triggerClassName="h-8 min-h-8 rounded-md px-2.5 text-xs font-medium"
            />
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              className="h-7 rounded-md px-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            >
              <X size={13} />
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className={dataTableCardClass}>
        <div className={cn(dataTableWrapperClass, 'overflow-x-auto')}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('leadId')}>
                  <div className="flex items-center">Lead ID {getSortIcon('leadId')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('pipelineStatus')}>
                  <div className="flex items-center">Status {getSortIcon('pipelineStatus')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('customerName')}>
                  <div className="flex items-center">Name {getSortIcon('customerName')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Assigned RM</TableHead>
                <TableHead className={dataTableHeadClass}>Assigned CM</TableHead>
                <TableHead className={dataTableHeadClass}>Email</TableHead>
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Monthly Income</TableHead>
                <TableHead className={dataTableHeadClass}>City</TableHead>
                <TableHead className={dataTableHeadClass}>Employment Type</TableHead>
                <TableHead className={dataTableHeadClass}>Source</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center">Lead Coming Date & Time {getSortIcon('createdAt')}</div>
                </TableHead>
                <DataTableActionHead visible={actionCol.showColumn} className="w-[80px] pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading leads…" />
              ) : loadError ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <p className="text-rose-500 font-bold text-sm">{loadError}</p>
                      {onRetry && (
                        <button type="button" onClick={onRetry} className="text-primary-deep text-xs font-bold hover:underline">
                          Retry
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead, idx) => (
                  <TableRow key={lead.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell label={lead.leadId} to={leadDetailsPath(lead.id, listReturnTo)} />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {(() => {
                        const statusLabel = statusColumnShowsCategory
                          ? lead.category
                          : lead.pipelineStatus;
                        if (!statusLabel) {
                          return <span className="text-slate-400">—</span>;
                        }
                        return (
                          <Badge
                            className={
                              statusColumnShowsCategory
                                ? leadStatusBadgeClass(statusLabel)
                                : leadPipelineStatusBadgeClass(statusLabel)
                            }
                          >
                            {statusLabel}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell
                        label={formatPersonName(lead.customerName)}
                        to={leadDetailsPath(lead.id, listReturnTo)}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{formatPersonName(lead.assignedRM)}</TableCell>
                    <TableCell className={dataTableCellClass}>{formatPersonName(lead.assignedCM)}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.email}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.mobile}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>{lead.pancard}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {formatCurrency(lead.monthlyIncome || 0)}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{lead.city}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>{lead.employmentType}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.source}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'whitespace-nowrap')}>
                      {formatAppDateTimeOrFallback(lead.createdAt)}
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={leadDetailsPath(lead.id, listReturnTo)}
                        onEdit={onEdit ? () => onEdit(lead) : undefined}
                        onDelete={onDelete ? () => onDelete(lead) : undefined}
                        externalDeleteConfirm={!!onDelete}
                        deleteDescription={`${lead.leadId} will be permanently removed.`}
                        extraActions={
                          canTransfer ? (
                            <RowTransferButton
                              onClick={() => onTransfer?.(lead)}
                              title="Transfer RM"
                              aria-label="Transfer lead"
                            />
                          ) : undefined
                        }
                      />
                    </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-600 mb-4">
                        <Search size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-sm">{emptyMessage}</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="text-primary-deep text-xs font-bold mt-2 hover:underline"
                        >
                          Clear all filters
                        </button>
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
        totalItems={footerTotal}
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
            options={[10, 20, 25, 50, 100]}
          />
        }
      />
    </div>
  );
}
