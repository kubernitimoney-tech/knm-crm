import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import {
  formatAppDateField,
  formatAppDateOrFallback,
  formatAppDateTimeOrFallback,
} from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { CibilScoreBadge } from '@/components/ui/CibilScoreBadge';
import { ExportButton } from '@/components/ui/ExportButton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
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
  TableAreaLoader,
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
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { cn, exportToExcel, formatPersonName, formatRatePercent } from '@/lib/utils';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { badgeClass, leadPipelineStatusBadgeClass, collectionStatusBadgeClass } from '@/lib/badgeStyles';
import {
  fetchAllCollectionReportRows,
  fetchAllDisbursedReportRows,
  fetchCollectionReportRows,
  fetchDisbursedReportRows,
  fetchReportingFilters,
  type CollectionReportRow,
  type DisbursedReportRow,
} from '@/lib/reportsApi';
import { toast } from '@/components/ui/toast';
import { disbursedLoanDeleteDescription, useLeadListingActions } from '@/hooks/useLeadListingActions';
import { deleteLead } from '@/lib/leadsApi';
import { deleteDisbursedLoan } from '@/lib/loansApi';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { periodToDateRange } from '@/lib/periodFilter';
import { LeadCategoryBadge } from '@/components/leads/LeadCategoryBadge';
import { RowViewButton } from '@/components/ui/data-table-row-action-buttons';

const REPORTING_TAB_ITEMS = [
  { value: 'disbursed', label: 'Disbursal' },
  { value: 'collection', label: 'Collection' },
] as const;

/** Rows arrive already filtered by the server; only sort the current page here. */
function sortReportingRows<T>(
  rows: T[],
  sortConfig: { key: string; direction: 'asc' | 'desc' | null },
): T[] {
  const result = [...rows];
  if (sortConfig.key && sortConfig.direction) {
    result.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortConfig.key] ?? '';
      const bVal = (b as Record<string, unknown>)[sortConfig.key] ?? '';
      if (String(aVal) < String(bVal)) return sortConfig.direction === 'asc' ? -1 : 1;
      if (String(aVal) > String(bVal)) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return result;
}

export function AllReportingPage() {
  useTitle('All Reporting Data');
  const [activeTab, setActiveTab] = useState('disbursed');
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
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
  const [disbursedData, setDisbursedData] = useState<DisbursedReportRow[]>([]);
  const [collectionData, setCollectionData] = useState<CollectionReportRow[]>([]);
  const [disbursedTotal, setDisbursedTotal] = useState(0);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Search is sent to the server after a short pause in typing.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  // Disbursal tab filters on disbursal date, Collection tab on collection date (server side).
  const serverFilters = useMemo(
    () => ({
      ...periodToDateRange(dateFilter, dateRange),
      branch: branchFilter,
      search: debouncedSearch,
    }),
    [dateFilter, dateRange, branchFilter, debouncedSearch],
  );

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = await fetchReportingFilters();
      setBranchOptions(filters.branches);
      // Load only the active tab and page — avoids fetching the full portfolio at once.
      if (activeTab === 'disbursed') {
        const page = await fetchDisbursedReportRows({
          ...serverFilters,
          page: currentPage,
          page_size: itemsPerPage,
        });
        setDisbursedData(page.results);
        setDisbursedTotal(page.count);
      } else {
        const page = await fetchCollectionReportRows({
          ...serverFilters,
          page: currentPage,
          page_size: itemsPerPage,
        });
        setCollectionData(page.results);
        setCollectionTotal(page.count);
      }
    } catch {
      toast({ title: 'Failed to load reporting data', variant: 'error' });
      if (activeTab === 'disbursed') {
        setDisbursedData([]);
        setDisbursedTotal(0);
      } else {
        setCollectionData([]);
        setCollectionTotal(0);
      }
      setBranchOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, itemsPerPage, serverFilters]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const deletingDisbursedLoan = activeTab === 'disbursed';
  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: loadReportData,
    deleteRequest: deletingDisbursedLoan
      ? (target) => deleteDisbursedLoan(target.id)
      : (target) => deleteLead(target.id),
    deleteTitle: deletingDisbursedLoan ? 'Delete disbursed loan?' : 'Delete this lead?',
    deleteConfirmLabel: deletingDisbursedLoan ? 'Delete loan' : 'Delete lead',
    deleteErrorTitle: deletingDisbursedLoan
      ? 'Failed to delete disbursed loan'
      : 'Failed to delete lead',
    deletedToastTitle: deletingDisbursedLoan ? 'Disbursed loan deleted' : 'Lead deleted',
    deletedToastDescription: deletingDisbursedLoan
      ? (target) => `Loan ${target.loanNo || target.leadId} has been deleted.`
      : undefined,
    deleteDescription: (target) =>
      deletingDisbursedLoan
        ? disbursedLoanDeleteDescription(target.loanNo || target.leadId)
        : `${target.leadId} will be permanently removed.`,
  });
  const actionCol = useLeadListingActionColumn();

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

  const hasActiveFilters = searchQuery !== '' || branchFilter !== 'All' || dateFilter !== 'All Time';

  const handleClearFilters = () => {
    setSearchQuery('');
    setBranchFilter('All');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setCurrentPage(1);
    setSortConfig({
      key: val === 'disbursed' ? 'disbursalDate' : 'collectionDateTime',
      direction: 'desc',
    });
    handleClearFilters();
  };

  const filteredAndSortedData = useMemo(
    () =>
      activeTab === 'disbursed'
        ? sortReportingRows(disbursedData, sortConfig)
        : sortReportingRows(collectionData, sortConfig),
    [activeTab, disbursedData, collectionData, sortConfig],
  );

  // The server already applied the filters, so its count is the filtered total.
  const footerTotal = activeTab === 'disbursed' ? disbursedTotal : collectionTotal;

  const paginatedData = filteredAndSortedData;

  const handleExport = async () => {
    let exportRows: DisbursedReportRow[] | CollectionReportRow[] = [];
    try {
      if (activeTab === 'disbursed') {
        exportRows = sortReportingRows(await fetchAllDisbursedReportRows(serverFilters), sortConfig);
      } else {
        exportRows = sortReportingRows(await fetchAllCollectionReportRows(serverFilters), sortConfig);
      }
    } catch {
      toast({ title: 'Export failed', description: 'Could not load all matching rows.', variant: 'error' });
      return;
    }
    if (!exportRows.length) {
      toast({
        title: 'Nothing to export',
        description: 'No rows match the current filters.',
        variant: 'error',
      });
      return;
    }
    if (activeTab === 'disbursed') {
      exportToExcel(
        exportRows as DisbursedReportRow[],
        DISBURSED_EXPORT_COLUMNS,
        `Disbursed_Reports_${format(new Date(), 'yyyy-MM-dd')}`,
        'Disbursal',
      );
    } else {
      exportToExcel(
        exportRows as CollectionReportRow[],
        COLLECTION_EXPORT_COLUMNS,
        `Collection_Reports_${format(new Date(), 'yyyy-MM-dd')}`,
        'Collection',
      );
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">All Reporting Data</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">Comprehensive overview of disbursed loans and collections</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="report.export" onClick={handleExport} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <ResponsiveTabsNav
          items={REPORTING_TAB_ITEMS}
          value={activeTab}
          onValueChange={handleTabChange}
        />

        <TabsContent value="disbursed" className="mt-0 animate-in slide-in-from-bottom-2 duration-300 space-y-3">
          <ReportingTabPanel
            isLoading={isLoading}
            filterToolbar={(
              <ReportingFilterToolbar
                dateLabel="Disbursal date"
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentPage={setCurrentPage}
                branchFilter={branchFilter}
                setBranchFilter={setBranchFilter}
                branchOptions={branchOptions}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                dateRange={dateRange}
                setDateRange={setDateRange}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            )}
            table={(
              <DisbursedTable
                paginatedData={paginatedData}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                handleSort={handleSort}
                getSortIcon={getSortIcon}
                openEditByLeadUuid={openEditByLeadUuid}
                setDeleteTarget={setDeleteTarget}
                actionCol={actionCol}
              />
            )}
            footer={(
              <DataTableFooter
                inset={false}
                currentPage={currentPage}
                totalItems={footerTotal}
                pageSize={itemsPerPage}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo(0, 0);
                }}
                leftExtra={(
                  <DataTablePageSizeSelect
                    value={itemsPerPage}
                    onChange={(size) => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                    options={[10, 25, 50]}
                  />
                )}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="collection" className="mt-0 animate-in slide-in-from-bottom-2 duration-300 space-y-3">
          <ReportingTabPanel
            isLoading={isLoading}
            filterToolbar={(
              <ReportingFilterToolbar
                dateLabel="Collection date"
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentPage={setCurrentPage}
                branchFilter={branchFilter}
                setBranchFilter={setBranchFilter}
                branchOptions={branchOptions}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                dateRange={dateRange}
                setDateRange={setDateRange}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            )}
            table={(
              <CollectionTable
                paginatedData={paginatedData}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                handleSort={handleSort}
                getSortIcon={getSortIcon}
                openEditByLeadUuid={openEditByLeadUuid}
                setDeleteTarget={setDeleteTarget}
                actionCol={actionCol}
              />
            )}
            footer={(
              <DataTableFooter
                inset={false}
                currentPage={currentPage}
                totalItems={footerTotal}
                pageSize={itemsPerPage}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo(0, 0);
                }}
                leftExtra={(
                  <DataTablePageSizeSelect
                    value={itemsPerPage}
                    onChange={(size) => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                    options={[10, 25, 50]}
                  />
                )}
              />
            )}
          />
        </TabsContent>
      </Tabs>
      {leadActionDialogs}
    </div>
  );
}

// Sub-components for cleaner code
function ReportingTabPanel({
  isLoading,
  filterToolbar,
  table,
  footer,
}: {
  isLoading: boolean;
  filterToolbar: React.ReactNode;
  table: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      {filterToolbar}
      <Card className={dataTableCardClass}>
        <div className="overflow-x-auto">
          {isLoading ? <TableAreaLoader message="Loading reporting data…" /> : table}
        </div>
      </Card>
      {footer}
    </>
  );
}

function ReportingFilterToolbar({
  searchQuery,
  setSearchQuery,
  setCurrentPage,
  branchFilter,
  setBranchFilter,
  branchOptions,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  hasActiveFilters,
  onClearFilters,
  dateLabel,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setCurrentPage: (page: number) => void;
  branchFilter: string;
  setBranchFilter: (value: string) => void;
  branchOptions: string[];
  dateFilter: string;
  setDateFilter: (value: string) => void;
  dateRange: { from: Date | undefined; to: Date | undefined };
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  dateLabel: string;
}) {
  return (
    <div className={dataTableFilterToolbarClass}>
      <DataTableSearchInput
        placeholder={searchPlaceholder('Name', 'Loan No', 'etc')}
        value={searchQuery}
        onChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
      />

      <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Select value={branchFilter} onValueChange={(val) => { setBranchFilter(val); setCurrentPage(1); }}>
          <SelectTrigger className={cn('w-[140px]', dataTableFilterControlClass)}>
            <SelectValue placeholder={selectPlaceholder('Branch')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Branches</SelectItem>
            {branchOptions.map((branch) => (
              <SelectItem key={branch} value={branch}>{branch}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{dateLabel}</span>
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
            onChange={(range) => {
              setDateRange({ from: range.from, to: range.to });
              setCurrentPage(1);
            }}
            defaultMonth={subMonths(new Date(), 1)}
            triggerClassName={dataTableDateRangeTriggerClass}
          />
        )}

        {hasActiveFilters && (
          <DataTableClearFiltersButton onClick={onClearFilters} />
        )}
      </div>
    </div>
  );
}

/** Blank, null and placeholder values show as "-" (column has no data). */
function dash(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text === '' || text === '—' ? '-' : text;
}

function amount(value: unknown): string {
  const text = dash(value);
  if (text === '-') return text;
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
}

function exportAmount(value: unknown): string | number {
  const text = dash(value);
  if (text === '-') return text;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

interface ReportColumn<T> {
  label: string;
  cell: (item: T) => React.ReactNode;
  exportValue: (item: T) => string | number;
  align?: 'right' | 'center';
  sortKey?: string;
  cellClassName?: string;
}

const DISBURSED_COLUMNS: ReportColumn<DisbursedReportRow>[] = [
  {
    label: 'Lead ID',
    sortKey: 'leadId',
    cell: (item) => <DataTablePrimaryCell label={item.leadId} to={`/leads/all/${item.id}`} />,
    exportValue: (item) => dash(item.leadId),
    cellClassName: nameCellClass,
  },
  { label: 'Loan No.', cell: (item) => dash(item.loanNo), exportValue: (item) => dash(item.loanNo) },
  { label: 'Branch', cell: (item) => dash(item.branch), exportValue: (item) => dash(item.branch) },
  {
    label: 'Name',
    sortKey: 'name',
    cell: (item) => (
      <DataTableCustomerNameCell label={formatPersonName(item.name)} to={leadDetailsPath(item.id)} />
    ),
    exportValue: (item) => dash(item.name),
    cellClassName: nameCellClass,
  },
  { label: 'DOB', cell: (item) => formatAppDateOrFallback(item.dob, '-'), exportValue: (item) => formatAppDateOrFallback(item.dob, '-') },
  { label: 'Gender', cell: (item) => dash(item.gender), exportValue: (item) => dash(item.gender) },
  { label: 'PAN No.', cell: (item) => dash(item.pan), exportValue: (item) => dash(item.pan), cellClassName: 'uppercase' },
  { label: 'Mobile No.', cell: (item) => dash(item.mob), exportValue: (item) => dash(item.mob) },
  { label: 'Email', cell: (item) => dash(item.email), exportValue: (item) => dash(item.email) },
  { label: 'Employment Type', cell: (item) => dash(item.employed), exportValue: (item) => dash(item.employed) },
  { label: 'Monthly Income', align: 'right', cell: (item) => amount(item.monthlyIncome), exportValue: (item) => exportAmount(item.monthlyIncome) },
  { label: 'Monthly Obligation', align: 'right', cell: (item) => amount(item.monthlyObligation), exportValue: (item) => exportAmount(item.monthlyObligation) },
  { label: 'Residence Type', cell: (item) => dash(item.recidanceType), exportValue: (item) => dash(item.recidanceType) },
  { label: 'Account No.', cell: (item) => dash(item.accountNo), exportValue: (item) => dash(item.accountNo) },
  { label: 'Bank IFSC', cell: (item) => dash(item.bankIfsc), exportValue: (item) => dash(item.bankIfsc) },
  { label: 'Bank Name', cell: (item) => dash(item.bankName), exportValue: (item) => dash(item.bankName) },
  { label: 'Account Type', cell: (item) => dash(item.accountType), exportValue: (item) => dash(item.accountType) },
  { label: 'Beneficiary Branch', cell: (item) => dash(item.beneficiaryBranch), exportValue: (item) => dash(item.beneficiaryBranch) },
  { label: 'Check No.', cell: (item) => dash(item.checkNo), exportValue: (item) => dash(item.checkNo) },
  { label: 'Credited By', cell: (item) => dash(formatPersonName(item.credBy)), exportValue: (item) => dash(item.credBy) },
  { label: 'PD By', cell: (item) => dash(formatPersonName(item.pdBy)), exportValue: (item) => dash(item.pdBy) },
  { label: 'PD Type', cell: (item) => dash(item.pdType), exportValue: (item) => dash(item.pdType) },
  { label: 'Loan Amount', align: 'right', cell: (item) => amount(item.loanAmt), exportValue: (item) => exportAmount(item.loanAmt) },
  { label: 'Processing Fee', align: 'right', cell: (item) => amount(item.processingFee), exportValue: (item) => exportAmount(item.processingFee) },
  { label: 'Tax', align: 'right', cell: (item) => amount(item.tax), exportValue: (item) => exportAmount(item.tax) },
  { label: 'Disbursed Amount', align: 'right', cell: (item) => amount(item.disbursedAmount), exportValue: (item) => exportAmount(item.disbursedAmount) },
  {
    label: 'CIBIL Score',
    align: 'center',
    cell: (item) => (dash(item.cibil) === '-' ? '-' : <CibilScoreBadge score={item.cibil} />),
    exportValue: (item) => dash(item.cibil),
  },
  { label: 'Tenure', cell: (item) => dash(item.tenure), exportValue: (item) => dash(item.tenure) },
  {
    label: 'ROI',
    cell: (item) => (dash(item.roi) === '-' ? '-' : formatRatePercent(item.roi)),
    exportValue: (item) => dash(item.roi),
  },
  {
    label: 'Status',
    align: 'center',
    cell: (item) => (dash(item.status) === '-' ? '-' : <Badge className={leadPipelineStatusBadgeClass(item.status)}>{item.status}</Badge>),
    exportValue: (item) => dash(item.status),
  },
  {
    label: 'Disbursal Date',
    sortKey: 'disbursalDate',
    cell: (item) => formatAppDateField(item.disbursalDate, '-'),
    exportValue: (item) => formatAppDateField(item.disbursalDate, '-'),
  },
  { label: 'Repay Date', cell: (item) => formatAppDateOrFallback(item.repayDate, '-'), exportValue: (item) => formatAppDateOrFallback(item.repayDate, '-') },
  { label: 'E-Nach Details', cell: (item) => dash(item.enachDetails), exportValue: (item) => dash(item.enachDetails) },
  { label: 'Disbursal Ref No.', cell: (item) => dash(item.disbursalRefNo), exportValue: (item) => dash(item.disbursalRefNo) },
  { label: 'CKYC No.', cell: (item) => dash(item.ckycNo), exportValue: (item) => dash(item.ckycNo) },
  { label: 'Company Account', cell: (item) => dash(item.companyAccount), exportValue: (item) => dash(item.companyAccount) },
  { label: 'UTM Source', cell: (item) => dash(item.utm), exportValue: (item) => dash(item.utm) },
  { label: 'Red Flagged', align: 'center', cell: (item) => dash(item.redFlag), exportValue: (item) => dash(item.redFlag) },
  {
    label: 'Loan Type',
    align: 'center',
    // Fresh / Reloan; the small badge is the reloan number (2nd loan = 1, 3rd = 2, ...).
    cell: (item) =>
      dash(item.loanType) === '-' ? '-' : (
        <LeadCategoryBadge category={item.loanType} customerLeadCount={item.reloanCount} />
      ),
    exportValue: (item) =>
      item.loanType === 'Reloan' && item.reloanCount > 0
        ? `Reloan (${item.reloanCount})`
        : dash(item.loanType),
  },
  {
    label: 'Lead Coming Date',
    cell: (item) => formatAppDateTimeOrFallback(item.leadComingDate, '-'),
    exportValue: (item) => formatAppDateTimeOrFallback(item.leadComingDate, '-'),
  },
];

const COLLECTION_COLUMNS: ReportColumn<CollectionReportRow>[] = [
  {
    label: 'Lead ID',
    sortKey: 'leadId',
    cell: (item) => <DataTablePrimaryCell label={item.leadId} to={`/leads/all/${item.id}`} />,
    exportValue: (item) => dash(item.leadId),
    cellClassName: nameCellClass,
  },
  { label: 'Loan No.', cell: (item) => dash(item.loanNo), exportValue: (item) => dash(item.loanNo) },
  { label: 'Branch', cell: (item) => dash(item.branch), exportValue: (item) => dash(item.branch) },
  {
    label: 'Name',
    sortKey: 'name',
    cell: (item) => (
      <DataTableCustomerNameCell label={formatPersonName(item.name)} to={leadDetailsPath(item.id)} />
    ),
    exportValue: (item) => dash(item.name),
    cellClassName: nameCellClass,
  },
  { label: 'Email', cell: (item) => dash(item.email), exportValue: (item) => dash(item.email) },
  { label: 'Mobile No.', cell: (item) => dash(item.mob), exportValue: (item) => dash(item.mob) },
  { label: 'PAN No.', cell: (item) => dash(item.pan), exportValue: (item) => dash(item.pan), cellClassName: 'uppercase' },
  {
    label: 'Repay Date',
    sortKey: 'repayDate',
    cell: (item) => formatAppDateOrFallback(item.repayDate, '-'),
    exportValue: (item) => formatAppDateOrFallback(item.repayDate, '-'),
  },
  { label: 'Collected Amount', align: 'right', cell: (item) => amount(item.collectedAmount), exportValue: (item) => exportAmount(item.collectedAmount) },
  { label: 'Loan Amount', align: 'right', cell: (item) => amount(item.loanAmount), exportValue: (item) => exportAmount(item.loanAmount) },
  { label: 'Repay Amount', align: 'right', cell: (item) => amount(item.repayAmount), exportValue: (item) => exportAmount(item.repayAmount) },
  { label: 'Interest Amount', align: 'right', cell: (item) => amount(item.interestAmt), exportValue: (item) => exportAmount(item.interestAmt) },
  { label: 'Penal Interest', align: 'right', cell: (item) => amount(item.penalInterest), exportValue: (item) => exportAmount(item.penalInterest) },
  { label: 'Excess Amount', align: 'right', cell: (item) => amount(item.excessAmount), exportValue: (item) => exportAmount(item.excessAmount) },
  { label: 'Wave-Off', align: 'right', cell: (item) => amount(item.waveOff), exportValue: (item) => exportAmount(item.waveOff) },
  { label: 'Settlement Amount', align: 'right', cell: (item) => amount(item.settelmentAmt), exportValue: (item) => exportAmount(item.settelmentAmt) },
  {
    label: 'Collected Mode',
    cell: (item) => (dash(item.collectedMode) === '-' ? '-' : <Badge className={badgeClass('neutral')}>{item.collectedMode}</Badge>),
    exportValue: (item) => dash(item.collectedMode),
  },
  { label: 'Reference No.', cell: (item) => dash(item.referenceNo), exportValue: (item) => dash(item.referenceNo) },
  { label: 'Collection Source', cell: (item) => dash(item.collectionSource), exportValue: (item) => dash(item.collectionSource) },
  { label: 'Collection Team', cell: (item) => dash(formatPersonName(item.collectionTeam)), exportValue: (item) => dash(item.collectionTeam) },
  {
    label: 'Status',
    align: 'center',
    cell: (item) => (dash(item.status) === '-' ? '-' : <Badge className={collectionStatusBadgeClass(item.status)}>{item.status}</Badge>),
    exportValue: (item) => dash(item.status),
  },
  { label: 'Remarks', cell: (item) => dash(item.remarks), exportValue: (item) => dash(item.remarks), cellClassName: 'max-w-[150px] truncate' },
  { label: 'Collection Date', cell: (item) => dash(item.collectionDate), exportValue: (item) => dash(item.collectionDate) },
  { label: 'Time', cell: (item) => dash(item.collectionTime), exportValue: (item) => dash(item.collectionTime) },
];

const DISBURSED_EXPORT_COLUMNS = DISBURSED_COLUMNS.map((column) => ({
  label: column.label,
  key: column.exportValue,
}));

const COLLECTION_EXPORT_COLUMNS = COLLECTION_COLUMNS.map((column) => ({
  label: column.label,
  key: column.exportValue,
}));

function alignClass(align?: 'right' | 'center') {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
}

function ReportHeadRow<T>({ columns, handleSort, getSortIcon, showAction }: {
  columns: ReportColumn<T>[];
  handleSort: (key: string) => void;
  getSortIcon: (key: string) => React.ReactNode;
  showAction: boolean;
}) {
  return (
    <TableRow className={dataTableHeaderRowClass}>
      {columns.map((column) =>
        column.sortKey ? (
          <TableHead
            key={column.label}
            className={cn(dataTableSortableHeadClass, alignClass(column.align))}
            onClick={() => handleSort(column.sortKey as string)}
          >
            <div className="flex items-center">
              {column.label} {getSortIcon(column.sortKey)}
            </div>
          </TableHead>
        ) : (
          <TableHead key={column.label} className={cn(dataTableHeadClass, alignClass(column.align))}>
            {column.label}
          </TableHead>
        ),
      )}
      <DataTableActionHead visible={showAction} />
    </TableRow>
  );
}

function DisbursedTable({ paginatedData, handleSort, getSortIcon, openEditByLeadUuid, setDeleteTarget, actionCol }: any) {
  const tableColSpan = DISBURSED_COLUMNS.length + (actionCol.showColumn ? 1 : 0);
  return (
    <Table>
      <TableHeader className={dataTableHeaderClass}>
        <ReportHeadRow
          columns={DISBURSED_COLUMNS}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          showAction={actionCol.showColumn}
        />
      </TableHeader>
      <TableBody>
        {paginatedData.length > 0 ? (
          paginatedData.map((item: DisbursedReportRow) => (
            <TableRow key={`${item.id}-${item.loanNo}`} className={dataTableBodyRowClass}>
              {DISBURSED_COLUMNS.map((column) => (
                <TableCell
                  key={column.label}
                  className={cn(column.cellClassName === nameCellClass ? nameCellClass : dataTableCellClass, alignClass(column.align), column.cellClassName !== nameCellClass ? column.cellClassName : '')}
                >
                  {column.cell(item)}
                </TableCell>
              ))}
              {actionCol.showColumn && (
                <TableCell className={dataTableActionCellClass}>
                  <DataTableListingActions
                    visibility={actionCol}
                    viewTo={leadDetailsPath(item.id)}
                    onEdit={() => openEditByLeadUuid(item.id)}
                    onDelete={() =>
                      setDeleteTarget({ id: item.id, leadId: item.leadId, loanNo: item.loanNo })
                    }
                    externalDeleteConfirm
                    deleteDescription={disbursedLoanDeleteDescription(item.loanNo || item.leadId)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))
        ) : (
          <EmptyState colSpan={tableColSpan} />
        )}
      </TableBody>
    </Table>
  );
}

function CollectionTable({ paginatedData, handleSort, getSortIcon }: any) {
  return (
    <Table>
      <TableHeader className={dataTableHeaderClass}>
        <ReportHeadRow
          columns={COLLECTION_COLUMNS}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
          showAction
        />
      </TableHeader>
      <TableBody>
        {paginatedData.length > 0 ? (
          paginatedData.map((item: CollectionReportRow) => (
            <TableRow key={item.repaymentId || `${item.id}-${item.collectionDateTime}`} className={dataTableBodyRowClass}>
              {COLLECTION_COLUMNS.map((column) => (
                <TableCell
                  key={column.label}
                  className={cn(column.cellClassName === nameCellClass ? nameCellClass : dataTableCellClass, alignClass(column.align), column.cellClassName !== nameCellClass ? column.cellClassName : '')}
                >
                  {column.cell(item)}
                </TableCell>
              ))}
              <TableCell className={dataTableActionCellClass}>
                <div className="flex items-center justify-center">
                  <RowViewButton
                    to={leadDetailsPath(item.id)}
                    title="View lead"
                    aria-label={`View lead ${item.leadId}`}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyState colSpan={COLLECTION_COLUMNS.length + 1} />
        )}
      </TableBody>
    </Table>
  );
}

function EmptyState({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-64 text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
            <Search size={32} />
          </div>
          <p className="text-slate-400 font-bold text-sm">No records found matching your filters</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
