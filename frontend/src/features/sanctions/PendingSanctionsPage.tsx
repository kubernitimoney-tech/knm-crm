import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  Clock,
  AlertCircle,
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { CibilScoreBadge } from '@/components/ui/CibilScoreBadge';
import { badgeClass } from '@/lib/badgeStyles';
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
} from "@/components/ui/table";
import {
  DataTablePrimaryCell,
  DataTableCustomerNameCell,
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
  dataTableFilterDividerClass,
  dataTableFilterControlClass,
  dataTableDateRangeTriggerClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { SanctionLead } from '@/types';
import { cn, exportRowsToExcel, formatCurrency, formatPersonName, formatRatePercent, buildExportFilename, periodFilterSlug } from '@/lib/utils';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { DateRangePicker } from '@/components/ui/date-picker';
import { usePipelineRows } from '@/hooks/usePipelineRows';
import { useLeadListingActions } from '@/hooks/useLeadListingActions';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export const PendingSanctionsPage = () => {
  useTitle('Pending Sanctions');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'date',
    direction: 'desc'
  });
  const { rows: pendingRows, isLoading, refetch } = usePipelineRows('sanction-pending');
  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: refetch,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = actionCol.showColumn ? 13 : 12;

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ?
      <ArrowUp size={12} className="ml-1 text-primary-deep" /> :
      <ArrowDown size={12} className="ml-1 text-primary-deep" />;
  };

  const hasActiveFilters = searchQuery !== '' || dateFilter !== 'All Time';

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      totalAmount: pendingRows.reduce((acc, curr) => acc + curr.loanAmount, 0),
      highPriority: pendingRows.filter(l => l.loanAmount > 200000).length,
      total: pendingRows.length
    };
  }, [pendingRows]);

  // Filtering & Sorting Logic
  const filteredAndSorted = useMemo(() => {
    const result = pendingRows.filter(lead => {
      const matchesSearch =
        lead.mobile.includes(searchQuery) ||
        lead.pancard.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.leadId.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesDate = true;
      const leadDate = new Date(lead.date);

      if (dateFilter === 'Today') {
        matchesDate = isWithinInterval(leadDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = leadDate >= subDays(new Date(), 7);
      } else if (dateFilter === 'Current Month') {
        matchesDate = leadDate >= startOfMonth(new Date());
      } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(leadDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }

      return matchesSearch && matchesDate;
    });

    // Sort
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof SanctionLead];
        const bVal = b[sortConfig.key as keyof SanctionLead];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [pendingRows, searchQuery, dateFilter, dateRange, sortConfig]);

  // Pagination Logic
  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = [
      'S.No',
      'Lead ID',
      'Name',
      'Mobile No.',
      'PAN No.',
      'Loan Amt.',
      'Tenure',
      'ROI',
      'Requested Date',
      'Monthly Income',
      'CIBIL',
      'Status'
    ];

    const data = filteredAndSorted.map((lead, index) => [
      index + 1,
      lead.leadId,
      lead.customerName,
      lead.mobile,
      lead.pancard,
      lead.loanAmount,
      lead.tenure,
      lead.roi,
      lead.date,
      lead.monthlyIncome,
      lead.cibil,
      lead.status
    ]);

    exportRowsToExcel(
      headers,
      data,
      buildExportFilename('sanction_pending_for_approval', periodFilterSlug(dateFilter)),
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Pending For Approval</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">
            Loan applications with documents pending or verified, awaiting sanction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="sanction.export" onClick={handleExport} />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Mobile', 'PAN', 'or Lead ID')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className={dataTableFilterDividerClass} />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
                triggerClassName={dataTableDateRangeTriggerClass}
              />
            )}

            {hasActiveFilters && (
              <DataTableClearFiltersButton onClick={handleClearFilters} />
            )}
          </div>
        </div>

        <Card className={dataTableCardClass}>
        <div className="overflow-x-auto overflow-y-hidden">
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('leadId')}>
                  <div className="flex items-center">Lead ID {getSortIcon('leadId')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Name</TableHead>
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('loanAmount')}>
                  <div className="flex items-center">Req. Amt. {getSortIcon('loanAmount')}</div>
                </TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>ROI</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>Tenure</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('date')}>
                  <div className="flex items-center">Requested On {getSortIcon('date')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Income</TableHead>
                <TableHead className={cn(dataTableSortableHeadClass, 'text-center')} onClick={() => handleSort('cibil')}>
                  <div className="flex items-center justify-center">CIBIL {getSortIcon('cibil')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Status</TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading pending sanctions…" />
              ) : paginated.length > 0 ? (
                paginated.map((lead, idx) => (
                  <TableRow key={lead.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell
                        label={lead.leadId}
                        to={`/leads/all/${lead.id}`}
                      />
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell
                        label={formatPersonName(lead.customerName)}
                        to={leadDetailsPath(lead.id)}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{lead.mobile}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>{lead.pancard}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                       {formatCurrency(lead.loanAmount)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      {formatRatePercent(lead.roi)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      {lead.tenure}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>
                       {formatAppDateTimeOrFallback(lead.date)}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                       {formatCurrency(lead.monthlyIncome)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <CibilScoreBadge score={lead.cibil} />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      <Badge className={badgeClass('warning')}>
                        PENDING
                      </Badge>
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={`/customers/${lead.customerId}`}
                        onEdit={() => openEditByLeadUuid(lead.id)}
                        onDelete={() => setDeleteTarget({ id: lead.id, leadId: lead.leadId })}
                        externalDeleteConfirm
                        deleteDescription={`${lead.leadId} will be permanently removed.`}
                      />
                    </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-64 p-0">
                    <div className="flex min-h-64 w-full flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                        <Search size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-sm">No pending sanctions found</p>
                      <button onClick={handleClearFilters} className="text-primary-deep text-xs font-bold mt-2 hover:underline">Clear all filters</button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTableFooter
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
              options={[10, 25, 50, 100]}
            />
          }
        />
        </Card>
      </div>
      {leadActionDialogs}
    </div>
  );
};
