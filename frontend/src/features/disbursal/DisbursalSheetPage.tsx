import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
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
  dataTableFilterControlClass,
  dataTableDateRangeTriggerClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
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

export const DisbursalSheetPage = () => {
  useTitle('Disbursal Sheet');
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
  const { rows: disbursalRows, isLoading, refetch } = usePipelineRows('disbursal-sheet');
  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: refetch,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = actionCol.showColumn ? 21 : 20;

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
      total: disbursalRows.length,
      amount: disbursalRows.reduce((acc, curr) => acc + (curr.disbursedAmount || 0), 0)
    };
  }, [disbursalRows]);

  // Filtering & Sorting Logic
  const filteredAndSorted = useMemo(() => {
    const result = disbursalRows.filter(lead => {
      const matchesSearch =
        lead.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobile.includes(searchQuery) ||
        lead.pancard.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.loanNo?.toLowerCase().includes(searchQuery.toLowerCase());

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
        const aVal = a[sortConfig.key as keyof SanctionLead] ?? '';
        const bVal = b[sortConfig.key as keyof SanctionLead] ?? '';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [disbursalRows, searchQuery, dateFilter, dateRange, sortConfig]);

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
      'Branch',
      'Email',
      'Mobile No.',
      'PAN No.',
      'Account No',
      'IFSC Code',
      'Loan No.',
      'Loan Account',
      'Disbursed Amt.',
      'Tenure',
      'ROI',
      'Repay Date',
      'Processing Fee',
      'Monthly Income',
      'CIBIL',
      'Status',
      'Date'
    ];

    const data = filteredAndSorted.map((lead, index) => [
      index + 1,
      lead.leadId,
      lead.customerName,
      lead.branch,
      lead.email,
      lead.mobile,
      lead.pancard,
      lead.accountNo,
      lead.ifscCode,
      lead.loanNo,
      lead.loanAccount,
      lead.disbursedAmount,
      lead.tenure,
      lead.roi,
      lead.repayDate,
      lead.processingFee,
      lead.monthlyIncome,
      lead.cibil,
      lead.status,
      lead.date
    ]);

    exportRowsToExcel(headers, data, `disbursal_sheet_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Disbursal sheet send</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">Prepared loan disbursal records for final payment</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="disbursal.export" onClick={handleExport} />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Mobile', 'PAN', 'or Loan No')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

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
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('customerName')}>
                  <div className="flex items-center">Name {getSortIcon('customerName')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Branch</TableHead>
                <TableHead className={dataTableHeadClass}>Email</TableHead>
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
                <TableHead className={dataTableHeadClass}>Account No.</TableHead>
                <TableHead className={dataTableHeadClass}>IFSC Code</TableHead>
                <TableHead className={dataTableHeadClass}>Loan No.</TableHead>
                <TableHead className={dataTableHeadClass}>Loan Account</TableHead>
                <TableHead className={cn(dataTableSortableHeadClass, 'text-right')} onClick={() => handleSort('disbursedAmount')}>
                  <div className="flex items-center justify-end">Disbursed Amt. {getSortIcon('disbursedAmount')}</div>
                </TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>Tenure</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>ROI</TableHead>
                <TableHead className={dataTableHeadClass}>Repay Date</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Processing Fee</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Monthly Income</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>Cibil</TableHead>
                <TableHead className={dataTableHeadClass}>Status</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('date')}>
                  <div className="flex items-center justify-end">Date {getSortIcon('date')}</div>
                </TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading disbursal sheet…" />
              ) : paginated.length > 0 ? (
                paginated.map((lead, idx) => (
                  <TableRow key={lead.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell
                        label={lead.leadId}
                        to={leadDetailsPath(lead.id)}
                      />
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell
                        label={formatPersonName(lead.customerName)}
                        to={leadDetailsPath(lead.id)}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{lead.branch}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.email}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.mobile}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>{lead.pancard}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.accountNo}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.ifscCode}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.loanNo}</TableCell>
                    <TableCell className={dataTableCellClass}>{lead.loanAccount}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {formatCurrency(lead.disbursedAmount || 0)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>{lead.tenure}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>{formatRatePercent(lead.roi)}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>
                       {formatAppDateOrFallback(lead.repayDate)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {formatCurrency(lead.processingFee)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {formatCurrency(lead.monthlyIncome)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <CibilScoreBadge score={lead.cibil} />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      <Badge className={badgeClass('info')}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {formatAppDateTimeOrFallback(lead.date)}
                    </TableCell>
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
                    <p className="text-slate-400 font-bold text-sm">No disbursal sheet records found</p>
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
            />
          }
        />
        </Card>
      </div>
      {leadActionDialogs}
    </div>
  );
};
