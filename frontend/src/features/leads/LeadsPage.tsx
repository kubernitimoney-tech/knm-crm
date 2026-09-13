import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ui/ExportButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  nameCellClass,
  dataTableCellClass,
  dataTableActionCellClass,
} from '@/components/ui/data-table';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Lead } from '@/types';
import { cn, exportToExcel, formatCurrency, formatPersonName, buildExportFilename, periodFilterSlug } from '@/lib/utils';
import {
  leadStatusBadgeClass,
  leadPipelineStatusBadgeClass,
  statSummaryBadgeClass,
} from '@/lib/badgeStyles';
import {
  fetchLeads,
  fetchLeadListSummary,
  fetchAllLeads,
  mapApiLeadToRow,
  deleteLead,
  ALL_LEADS_STATUS_FILTER_OPTIONS,
  allLeadsStatusFilterFetchParams,
  leadSortToOrdering,
  leadFreshReloanPillStatusFilter,
  LEAD_LIST_EXPORT_HEADERS,
  formatLeadListExportRow,
} from '@/lib/leadsApi';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { TransferLeadDialog } from '@/components/leads/TransferLeadDialog';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { AxiosError } from 'axios';
import { toast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
  RowTransferButton,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';

function leadCategoryAccent(status: string) {
  if (status === 'Fresh') return 'bg-emerald-400';
  if (status === 'Reloan') return 'bg-blue-400';
  return 'bg-amber-400';
}

export const LeadsPage = () => {
  useTitle('Leads Management');
  const { hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canCreateLead = hasPermission('lead.create');
  const canTransfer = hasPermission('lead.assign') && (isSuperAdmin || isAdmin);
  const actionCol = useLeadListingActionColumn({ extra: canTransfer });
  const tableColSpan = actionCol.showColumn ? 15 : 14;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, fresh: 0, reloan: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [transferLead, setTransferLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLead(deleteTarget.id);
      toast({ title: 'Lead deleted', description: `${deleteTarget.leadId} removed.`, variant: 'success' });
      setDeleteTarget(null);
      loadLeads();
    } catch (err) {
      toast({
        title: 'Failed to delete lead',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const { isAuthenticated } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'createdAt',
    direction: 'desc'
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  /** Query params shared by the paginated list and /leads/summary/ count endpoint. */
  const listQueryParams = useMemo(() => {
    const statusParams =
      pipelineStatusFilter === 'All' || pipelineStatusFilter === 'Disbursed'
        ? {}
        : allLeadsStatusFilterFetchParams(pipelineStatusFilter);
    const applicationStatus =
      pipelineStatusFilter === 'Disbursed' ? 'disbursed' : statusParams.application_status;

    let date_from: string | undefined;
    let date_to: string | undefined;
    const today = new Date();
    if (dateFilter === 'Today') {
      date_from = format(startOfDay(today), 'yyyy-MM-dd');
      date_to = format(endOfDay(today), 'yyyy-MM-dd');
    } else if (dateFilter === 'Last 7 Days') {
      date_from = format(subDays(today, 7), 'yyyy-MM-dd');
      date_to = format(today, 'yyyy-MM-dd');
    } else if (dateFilter === 'Current Month') {
      date_from = format(startOfMonth(today), 'yyyy-MM-dd');
      date_to = format(today, 'yyyy-MM-dd');
    } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
      date_from = format(startOfDay(dateRange.from), 'yyyy-MM-dd');
      date_to = format(endOfDay(dateRange.to), 'yyyy-MM-dd');
    }

    return {
      search: debouncedSearch || undefined,
      status: leadFreshReloanPillStatusFilter(categoryFilter) ?? statusParams.status,
      application_status: applicationStatus,
      date_from,
      date_to,
      ordering: leadSortToOrdering(sortConfig.key, sortConfig.direction),
    };
  }, [
    debouncedSearch,
    categoryFilter,
    pipelineStatusFilter,
    dateFilter,
    dateRange,
    sortConfig,
  ]);

  const loadLeads = useCallback(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setLoadError('');

    Promise.all([
      fetchLeads({ ...listQueryParams, page: currentPage, page_size: itemsPerPage }),
      fetchLeadListSummary(listQueryParams),
    ])
      .then(([page, counts]) => {
        setLeads(page.results.map((lead) => mapApiLeadToRow(lead)));
        setTotalCount(page.count);
        setSummary({
          total: counts.total,
          fresh: counts.fresh,
          reloan: counts.reloan,
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load leads';
        setLoadError(message);
        const status = err instanceof AxiosError ? err.response?.status : undefined;
        if (status === 401) {
          toast({
            title: 'Session expired',
            description: 'Please sign in again to view leads.',
            variant: 'error',
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, listQueryParams, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, categoryFilter, pipelineStatusFilter, dateFilter, dateRange.from, dateRange.to, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ?
      <ArrowUp size={12} className="ml-1 text-primary-deep" /> :
      <ArrowDown size={12} className="ml-1 text-primary-deep" />;
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    categoryFilter !== 'All' ||
    pipelineStatusFilter !== 'All' ||
    dateFilter !== 'All Time';

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All');
    setPipelineStatusFilter('All');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const categoryCounts = useMemo(
    () => ({
      all: summary.total,
      fresh: summary.fresh,
      reloan: summary.reloan,
    }),
    [summary],
  );

  const stats = useMemo(
    () => ({
      fresh: summary.fresh,
      reloan: summary.reloan,
      total: summary.total,
    }),
    [summary],
  );

  const paginatedLeads = leads;

  /** Export downloads all matching rows; the table itself stays server-paginated. */
  const handleExport = async () => {
    try {
      const rows = (await fetchAllLeads(listQueryParams)).map((lead) => mapApiLeadToRow(lead));
      if (!rows.length) {
        toast({
          title: 'Nothing to export',
          description: 'No leads match the current filters.',
          variant: 'error',
        });
        return;
      }

      const exportRows = rows.map((lead, index) => formatLeadListExportRow(lead, index));
      exportToExcel(
        exportRows,
        LEAD_LIST_EXPORT_HEADERS.map((label) => ({ label, key: label as keyof (typeof exportRows)[number] })),
        buildExportFilename('leads', periodFilterSlug(dateFilter)),
        'Leads',
        { module: 'lead', screen: 'all-leads', label: 'All Leads list' },
      );
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-bold text-slate-950 tracking-tight">All Leads</h1>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className={statSummaryBadgeClass('total')}>
              <span className="font-semibold opacity-80">Total:</span>
              <span className="font-bold tabular-nums">{stats.total.toLocaleString()}</span>
            </span>
            <span className={statSummaryBadgeClass('fresh')}>
              <span className="font-semibold opacity-80">Fresh:</span>
              <span className="font-bold tabular-nums">{stats.fresh.toLocaleString()}</span>
            </span>
            <span className={statSummaryBadgeClass('reloan')}>
              <span className="font-semibold opacity-80">Reloan:</span>
              <span className="font-bold tabular-nums">{stats.reloan.toLocaleString()}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="lead.export" onClick={handleExport} />
          {canCreateLead && (
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="h-9 bg-primary-deep hover:bg-primary-deep/90 text-white rounded-md px-4 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Lead
            </Button>
          )}
        </div>
      </div>

      <AddLeadDialog isOpen={isAddOpen} onOpenChange={setIsAddOpen} onAdd={loadLeads} />
      <TransferLeadDialog
        isOpen={transferLead !== null}
        onOpenChange={(open) => { if (!open) setTransferLead(null); }}
        lead={transferLead}
        onTransferred={loadLeads}
      />
      <EditLeadDialog
        isOpen={editLead !== null}
        onOpenChange={(open) => { if (!open) setEditLead(null); }}
        lead={editLead}
        onUpdated={loadLeads}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete this lead?"
        description={
          deleteTarget
            ? `${deleteTarget.leadId} (${deleteTarget.customerName}) will be removed from the pipeline. This action can only be undone by a database administrator.`
            : undefined
        }
        confirmLabel="Delete Lead"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      <div className={dataTableStackClass}>
        <div className={dataTableFilterToolbarClass}>
          <div className="relative min-w-[200px] flex-1 max-w-xl">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input
              placeholder={searchPlaceholder('Name', 'Mobile', 'or Lead ID')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                'pl-8 focus-visible:ring-primary-deep/10',
                dataTableFilterControlClass,
              )}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select
              value={pipelineStatusFilter}
              onValueChange={(val) => {
                setPipelineStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className={cn('w-[200px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                {ALL_LEADS_STATUS_FILTER_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(val) => { setDateFilter(val); setCurrentPage(1); }}>
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
                onChange={setDateRange}
                defaultMonth={subMonths(new Date(), 1)}
                triggerClassName="h-8 min-h-8 rounded-md px-2.5 text-xs font-medium"
              />
            )}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="h-7 rounded-md px-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-600"
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
                  <div className="flex items-center">
                    Lead ID {getSortIcon('leadId')}
                  </div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('pipelineStatus')}>
                  <div className="flex items-center">
                    Status {getSortIcon('pipelineStatus')}
                  </div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('customerName')}>
                  <div className="flex items-center">
                    Name {getSortIcon('customerName')}
                  </div>
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
                  <div className="flex items-center">
                    Lead Coming Date & Time {getSortIcon('createdAt')}
                  </div>
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
                      <button onClick={loadLeads} className="text-primary-deep text-xs font-bold hover:underline">Retry</button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead, idx) => (
                  <TableRow key={`${lead.id}-${lead.leadId}-${idx}`} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell
                        label={lead.leadId}
                        to={leadDetailsPath(lead.id, { type: 'all-leads' })}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {lead.pipelineStatus ? (
                        <Badge className={leadPipelineStatusBadgeClass(lead.pipelineStatus)}>
                          {lead.pipelineStatus}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell
                        label={formatPersonName(lead.customerName)}
                        to={leadDetailsPath(lead.id, { type: 'all-leads' })}
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
                        viewTo={leadDetailsPath(lead.id, { type: 'all-leads' })}
                        onEdit={() => setEditLead(lead)}
                        onDelete={() => setDeleteTarget(lead)}
                        externalDeleteConfirm
                        deleteDescription={`${lead.leadId} will be permanently removed.`}
                        extraActions={
                          canTransfer ? (
                            <RowTransferButton
                              onClick={() => setTransferLead(lead)}
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
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                        <Search size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-sm">No leads found matching your filters</p>
                      <button onClick={handleClearFilters} className="text-primary-deep text-xs font-bold mt-2 hover:underline">Clear all filters</button>
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
          totalItems={totalCount}
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
    </div>
  );
};
