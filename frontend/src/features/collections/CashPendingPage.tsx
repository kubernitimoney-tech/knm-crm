import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { matchesPeriodFilter } from '@/lib/periodFilter';
import { formatAppDateOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { leadPipelineStatusBadgeClass } from '@/lib/badgeStyles';
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
  nameCellClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  dataTableFilterControlClass,
  dataTableDateRangeTriggerClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
} from '@/components/ui/data-table';
import { SanctionLead } from '@/types';
import { cn, exportRowsToExcel, formatCurrency, formatPersonName, formatRatePercent } from '@/lib/utils';
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

type CashPendingRow = ReturnType<typeof usePipelineRows>['rows'][number];

/** Blank values show as "-" in the table and the export. */
function dash(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text === '' || text === '—' ? '-' : text;
}

function money(value: unknown): string {
  const text = dash(value);
  if (text === '-') return text;
  const number = Number(text);
  return Number.isFinite(number) ? formatCurrency(number) : text;
}

function exportMoney(value: unknown): string | number {
  const text = dash(value);
  if (text === '-') return text;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

interface CashPendingColumn {
  label: string;
  cell: (row: CashPendingRow) => React.ReactNode;
  exportValue: (row: CashPendingRow) => string | number;
  sortKey?: string;
  align?: 'right' | 'center';
  primary?: boolean;
}

const CASH_PENDING_COLUMNS: CashPendingColumn[] = [
  {
    label: 'Lead ID',
    sortKey: 'leadId',
    primary: true,
    cell: (row) => <DataTablePrimaryCell label={row.leadId} to={`/leads/all/${row.id}`} />,
    exportValue: (row) => dash(row.leadId),
  },
  {
    label: 'Name',
    sortKey: 'customerName',
    primary: true,
    cell: (row) => (
      <DataTableCustomerNameCell label={formatPersonName(row.customerName)} to={leadDetailsPath(row.id)} />
    ),
    exportValue: (row) => dash(row.customerName),
  },
  { label: 'Branch', cell: (row) => dash(row.branch), exportValue: (row) => dash(row.branch) },
  { label: 'Loan ID', cell: (row) => dash(row.loanNo), exportValue: (row) => dash(row.loanNo) },
  { label: 'Email', cell: (row) => dash(row.email), exportValue: (row) => dash(row.email) },
  { label: 'Mobile No.', cell: (row) => dash(row.mobile), exportValue: (row) => dash(row.mobile) },
  { label: 'Loan Amt.', sortKey: 'loanAmount', align: 'right', cell: (row) => money(row.loanAmount), exportValue: (row) => exportMoney(row.loanAmount) },
  { label: 'Repayment Amt', align: 'right', cell: (row) => money(row.repayAmount), exportValue: (row) => exportMoney(row.repayAmount) },
  { label: 'Collected Amount', align: 'right', cell: (row) => money(row.collectedAmount), exportValue: (row) => exportMoney(row.collectedAmount) },
  { label: 'Till Date Amount', align: 'right', cell: (row) => money(row.tillDateAmount), exportValue: (row) => exportMoney(row.tillDateAmount) },
  { label: 'Processing Fee', align: 'right', cell: (row) => money(row.processingFee), exportValue: (row) => exportMoney(row.processingFee) },
  { label: 'ROI', align: 'center', cell: (row) => formatRatePercent(row.roi), exportValue: (row) => row.roi ?? '-' },
  { label: 'Tenure', align: 'center', cell: (row) => dash(row.tenure), exportValue: (row) => dash(row.tenure) },
  {
    label: 'Repay Date',
    sortKey: 'repayDate',
    cell: (row) => formatAppDateOrFallback(row.repayDate, '-'),
    exportValue: (row) => formatAppDateOrFallback(row.repayDate, '-'),
  },
  {
    label: 'Disbursal Date',
    sortKey: 'disbursalDate',
    cell: (row) => formatAppDateOrFallback(row.disbursalDate, '-'),
    exportValue: (row) => formatAppDateOrFallback(row.disbursalDate, '-'),
  },
  {
    label: 'Status',
    align: 'center',
    cell: (row) => (dash(row.status) === '-' ? '-' : <Badge className={leadPipelineStatusBadgeClass(row.status)}>{row.status}</Badge>),
    exportValue: (row) => dash(row.status),
  },
  { label: 'Credit By', cell: (row) => dash(formatPersonName(row.creditBy ?? '')), exportValue: (row) => dash(row.creditBy) },
  { label: 'Customer Type', cell: (row) => dash(row.customerType), exportValue: (row) => dash(row.customerType) },
];

function alignClass(align?: 'right' | 'center') {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
}

export const CashPendingPage = () => {
  useTitle('Cash Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'repayDate',
    direction: 'asc'
  });
  const { rows: cashPendingRows, isLoading, refetch } = usePipelineRows('cash-pending');
  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: refetch,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = CASH_PENDING_COLUMNS.length + (actionCol.showColumn ? 1 : 0);

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

  // Filtering & Sorting Logic
  const filteredAndSorted = useMemo(() => {
    const result = cashPendingRows.filter(lead => {
      const matchesSearch =
        lead.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobile.includes(searchQuery) ||
        lead.pancard.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.loanNo?.toLowerCase().includes(searchQuery.toLowerCase());

      // Period filter applies to the repay date.
      const matchesDate = matchesPeriodFilter(lead.repayDate, dateFilter, dateRange);

      return matchesSearch && matchesDate;
    });

    // Sort
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof SanctionLead] ?? '';
        const bVal = b[sortConfig.key as keyof SanctionLead] ?? '';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [cashPendingRows, searchQuery, dateFilter, dateRange, sortConfig]);

  // Pagination Logic
  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export follows the same filters (repay date, search) and columns as the table.
  const handleExport = () => {
    const headers = CASH_PENDING_COLUMNS.map((column) => column.label);
    const data = filteredAndSorted.map((row) => CASH_PENDING_COLUMNS.map((column) => column.exportValue(row)));
    exportRowsToExcel(headers, data, `cash_pending_records_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Cash Pending</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">
            All disbursed loans awaiting first collection (not closed or settled)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="collection.export" onClick={handleExport} />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Mobile', 'PAN', 'or Loan ID')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Repay date</span>
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
                onChange={(range) => { setDateRange({ from: range.from, to: range.to }); setCurrentPage(1); }}
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
                {CASH_PENDING_COLUMNS.map((column) =>
                  column.sortKey ? (
                    <TableHead
                      key={column.label}
                      className={cn(dataTableSortableHeadClass, alignClass(column.align))}
                      onClick={() => handleSort(column.sortKey as string)}
                    >
                      <div className={cn('flex items-center', column.align === 'right' && 'justify-end')}>
                        {column.label} {getSortIcon(column.sortKey)}
                      </div>
                    </TableHead>
                  ) : (
                    <TableHead key={column.label} className={cn(dataTableHeadClass, alignClass(column.align))}>
                      {column.label}
                    </TableHead>
                  ),
                )}
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading cash pending…" />
              ) : paginated.length > 0 ? (
                paginated.map((lead) => (
                  <TableRow key={lead.id} className={dataTableBodyRowClass}>
                    {CASH_PENDING_COLUMNS.map((column) => (
                      <TableCell
                        key={column.label}
                        className={cn(column.primary ? nameCellClass : dataTableCellClass, alignClass(column.align))}
                      >
                        {column.cell(lead)}
                      </TableCell>
                    ))}
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={leadDetailsPath(lead.id)}
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
                  <TableCell colSpan={tableColSpan} className="h-64 text-center">
                    <p className="text-slate-400 font-bold text-sm">No cash pending cases found</p>
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
        />
      </div>
      {leadActionDialogs}
    </div>
  );
};
