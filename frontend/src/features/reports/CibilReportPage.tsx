import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { formatAppDateField, formatAppDateOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { CibilScoreBadge } from '@/components/ui/CibilScoreBadge';
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
import { cn, exportRowsToExcel, formatPersonName, formatRatePercent } from '@/lib/utils';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { DateRangePicker } from '@/components/ui/date-picker';
import {
  fetchAllCibilReportRows,
  fetchReportingFilters,
  type CibilReportRow,
} from '@/lib/reportsApi';
import { toast } from '@/components/ui/toast';
import { useLeadListingActions } from '@/hooks/useLeadListingActions';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export function CibilReportPage() {
  useTitle('Cibil Report');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'disbursalDate',
    direction: 'desc'
  });
  const [reportData, setReportData] = useState<CibilReportRow[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [filters, rows] = await Promise.all([
        fetchReportingFilters(),
        fetchAllCibilReportRows(),
      ]);
      setStateOptions(filters.states);
      setReportData(Array.isArray(rows) ? rows : []);
    } catch {
      toast({ title: 'Failed to load CIBIL report data', variant: 'error' });
      setReportData([]);
      setStateOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: loadReportData,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = actionCol.showColumn ? 27 : 26;

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

  const hasActiveFilters = searchQuery !== '' || stateFilter !== 'All' || dateFilter !== 'All Time';

  const handleClearFilters = () => {
    setSearchQuery('');
    setStateFilter('All');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    const source = Array.isArray(reportData) ? reportData : [];
    const result = source.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mob.includes(searchQuery) ||
        item.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.loanNo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesState = stateFilter === 'All' || item.state === stateFilter;

      let matchesDate = true;
      const disbursalDate = new Date(item.disbursalDate);

      if (dateFilter === 'Today') {
        matchesDate = isWithinInterval(disbursalDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = disbursalDate >= subDays(new Date(), 7);
      } else if (dateFilter === 'Current Month') {
        matchesDate = disbursalDate >= startOfMonth(new Date());
      } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(disbursalDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }

      return matchesSearch && matchesState && matchesDate;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [searchQuery, stateFilter, dateFilter, dateRange, sortConfig, reportData]);

  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = [
      'S.No.', 'Lead ID', 'Loan No.', 'Name', 'DOB', 'Gender', 'PAN No.', 'Aadhaar No.',
      'Mobile No.', 'Email', 'Address', 'Address Category', 'Address Type', 'State',
      'Pin Code', 'Disbursal Date', 'Repay Date', 'Tenure', 'ROI', 'Loan Amt.',
      'Repay Amt', 'Account No', 'IFSC Code', 'Bank Branch', 'Bank Name', 'CIBIL Score'
    ];

    const data = filteredAndSortedData.map((item, index) => [
      index + 1,
      item.leadId,
      item.loanNo,
      item.name,
      item.dob,
      item.gender,
      item.pan,
      item.adharCard,
      item.mob,
      item.email,
      item.address,
      item.addressCategory,
      item.addressType,
      item.state,
      item.pinCode,
      item.disbursalDate,
      item.repayDate,
      item.tenure,
      item.roi,
      item.loanAmt,
      item.repayAmt,
      item.accountNo,
      item.ifscCode,
      item.bankBranch,
      item.bankName,
      item.cibilScore,
    ]);

    exportRowsToExcel(headers, data, `cibil_report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Cibil Report</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">View and export detailed CIBIL scores and customer data</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="report.export" onClick={handleExport} />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Mobile', 'etc')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={stateFilter} onValueChange={(val) => { setStateFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className={cn('w-[140px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('State')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All States</SelectItem>
                {stateOptions.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
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
                triggerClassName={dataTableDateRangeTriggerClass}
              />
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
                <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('leadId')}>
                  <div className="flex items-center">Lead ID {getSortIcon('leadId')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Loan No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name {getSortIcon('name')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>DOB</TableHead>
                <TableHead className={dataTableHeadClass}>Gender</TableHead>
                <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
                <TableHead className={dataTableHeadClass}>Aadhaar No.</TableHead>
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={dataTableHeadClass}>Email</TableHead>
                <TableHead className={dataTableHeadClass}>Address</TableHead>
                <TableHead className={dataTableHeadClass}>Category</TableHead>
                <TableHead className={dataTableHeadClass}>Type</TableHead>
                <TableHead className={dataTableHeadClass}>State</TableHead>
                <TableHead className={dataTableHeadClass}>Pin</TableHead>
                <TableHead className={dataTableHeadClass}>Disbursal</TableHead>
                <TableHead className={dataTableHeadClass}>Repay Date</TableHead>
                <TableHead className={dataTableHeadClass}>Tenure</TableHead>
                <TableHead className={dataTableHeadClass}>ROI</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Loan Amt.</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Repay Amt.</TableHead>
                <TableHead className={dataTableHeadClass}>Account No.</TableHead>
                <TableHead className={dataTableHeadClass}>IFSC</TableHead>
                <TableHead className={dataTableHeadClass}>Bank Branch</TableHead>
                <TableHead className={dataTableHeadClass}>Bank Name</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>CIBIL</TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading CIBIL report data…" />
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <TableRow key={item.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell
                        label={item.leadId}
                        to={`/leads/all/${item.id}`}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.loanNo}</TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell
                        label={formatPersonName(item.name)}
                        to={leadDetailsPath(item.id)}
                      />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.dob}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.gender}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'uppercase')}>{item.pan}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.adharCard}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.mob}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.email}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'max-w-xs truncate')}>{item.address}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.addressCategory}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.addressType}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.state}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.pinCode}</TableCell>
                    <TableCell className={dataTableCellClass}>{formatAppDateField(item.disbursalDate)}</TableCell>
                    <TableCell className={dataTableCellClass}>{formatAppDateOrFallback(item.repayDate)}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.tenure}</TableCell>
                    <TableCell className={dataTableCellClass}>{formatRatePercent(item.roi)}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.loanAmt)}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.repayAmt)}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.accountNo}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.ifscCode}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.bankBranch}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.bankName}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <CibilScoreBadge score={item.cibilScore} />
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={leadDetailsPath(item.id)}
                        onEdit={() => openEditByLeadUuid(item.id)}
                        onDelete={() => setDeleteTarget({ id: item.id, leadId: item.leadId })}
                        externalDeleteConfirm
                        deleteDescription={`${item.leadId} will be permanently removed.`}
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
                      <p className="text-slate-400 font-bold text-sm">No records found matching your filters</p>
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
          totalItems={filteredAndSortedData.length}
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
              options={[10, 25, 50]}
            />
          }
        />
      </div>
      {leadActionDialogs}
    </div>
  );
}
