import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
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
import { cn, exportToExcel, formatPersonName, formatRatePercent } from '@/lib/utils';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { badgeClass, leadPipelineStatusBadgeClass, collectionStatusBadgeClass } from '@/lib/badgeStyles';
import {
  fetchCollectionReportRows,
  fetchDisbursedReportRows,
  fetchReportingFilters,
  type CollectionReportRow,
  type DisbursedReportRow,
} from '@/lib/reportsApi';
import { toast } from '@/components/ui/toast';
import { useLeadListingActions } from '@/hooks/useLeadListingActions';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';

const REPORTING_TAB_ITEMS = [
  { value: 'disbursed', label: 'Disbursal' },
  { value: 'collection', label: 'Collection' },
] as const;

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

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = await fetchReportingFilters();
      setBranchOptions(filters.branches);
      // Load only the active tab and page — avoids fetching the full portfolio at once.
      if (activeTab === 'disbursed') {
        const page = await fetchDisbursedReportRows({
          page: currentPage,
          page_size: itemsPerPage,
        });
        setDisbursedData(page.results);
        setDisbursedTotal(page.count);
      } else {
        const page = await fetchCollectionReportRows({
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
  }, [activeTab, currentPage, itemsPerPage]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: loadReportData,
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
      key: val === 'disbursed' ? 'disbursalDate' : 'repayDate',
      direction: 'desc',
    });
    handleClearFilters();
  };

  const currentData = activeTab === 'disbursed' ? disbursedData : collectionData;

  const filteredAndSortedData = useMemo(() => {
    const result = currentData.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mob.includes(searchQuery) ||
        item.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.loanNo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBranch = branchFilter === 'All' || item.branch === branchFilter;

      let matchesDate = true;
      const targetDate = new Date(activeTab === 'disbursed' ? item.disbursalDate : item.repayDate);

      if (dateFilter === 'Today') {
        matchesDate = isWithinInterval(targetDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = targetDate >= subDays(new Date(), 7);
      } else if (dateFilter === 'Current Month') {
        matchesDate = targetDate >= startOfMonth(new Date());
      } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(targetDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }

      return matchesSearch && matchesBranch && matchesDate;
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
  }, [searchQuery, branchFilter, dateFilter, dateRange, sortConfig, activeTab, currentData]);

  const serverTotal = activeTab === 'disbursed' ? disbursedTotal : collectionTotal;
  const footerTotal = hasActiveFilters ? filteredAndSortedData.length : serverTotal;

  const paginatedData = filteredAndSortedData;

  const handleExport = () => {
    if (activeTab === 'disbursed') {
      const headers = [
        { label: 'Lead ID', key: 'leadId' },
        { label: 'Lead Coming Date', key: 'leadComingDate' },
        { label: 'Loan No.', key: 'loanNo' },
        { label: 'Name', key: 'name' },
        { label: 'DOB', key: 'dob' },
        { label: 'Gender', key: 'gender' },
        { label: 'PAN No.', key: 'pan' },
        { label: 'Aadhaar No.', key: 'adharCard' },
        { label: 'Mobile No.', key: 'mob' },
        { label: 'Email', key: 'email' },
        { label: 'Branch', key: 'branch' },
        { label: 'Credited By', key: 'credBy' },
        { label: 'PD By', key: 'pdBy' },
        { label: 'Employment Status', key: 'employed' },
        { label: 'Monthly Income', key: (item: any) => `${parseFloat(item.monthlyIncome)}` },
        { label: 'Monthly Obligation', key: (item: any) => `${parseFloat(item.monthlyObligation)}` },
        { label: 'Loan Amount', key: (item: any) => `${parseFloat(item.loanAmt)}` },
        { label: 'Tenure', key: 'tenure' },
        { label: 'ROI', key: 'roi' },
        { label: 'Status', key: 'status' },
        { label: 'Disbursal Date', key: 'disbursalDate' },
        { label: 'Repay Date', key: 'repayDate' },
        { label: 'Residence Type', key: 'recidanceType' },
        { label: 'Account No.', key: 'accountNo' },
        { label: 'Bank IFSC', key: 'bankIfsc' },
        { label: 'Bank Name', key: 'bankName' },
        { label: 'Account Type', key: 'accountType' },
        { label: 'Beneficiary Branch', key: 'beneficiaryBranch' },
        { label: 'Check No.', key: 'checkNo' },
        { label: 'E-Nach Details', key: 'enachDetails' },
        { label: 'Disbursal Ref No.', key: 'disbursalRefNo' },
        { label: 'Company Account', key: 'companyAccount' },
        { label: 'Processing Fee', key: (item: any) => `${parseFloat(item.processingFee)}` },
        { label: 'Tax', key: (item: any) => `${parseFloat(item.tax)}` },
        { label: 'CIBIL Score', key: 'cibil' },
        { label: 'UTM Search', key: 'utm' },
        { label: 'State', key: 'state' },
        { label: 'Red Flagged', key: 'redFlag' },
      ];
      exportToExcel(filteredAndSortedData, headers as any, `Disbursed_Reports_${format(new Date(), 'yyyy-MM-dd')}`, 'Disbursal');
    } else {
      const headers = [
        { label: 'Lead ID', key: 'leadId' },
        { label: 'Loan No.', key: 'loanNo' },
        { label: 'Branch', key: 'branch' },
        { label: 'Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Mobile No.', key: 'mob' },
        { label: 'PAN No.', key: 'pan' },
        { label: 'State', key: 'state' },
        { label: 'Repay Date', key: 'repayDate' },
        { label: 'Collected Amount', key: (item: any) => `${parseFloat(item.collectedAmount)}` },
        { label: 'Principal Amount', key: (item: any) => `${parseFloat(item.principalAmt)}` },
        { label: 'Interest Amount', key: (item: any) => `${parseFloat(item.interestAmt)}` },
        { label: 'Penal Interest', key: (item: any) => `${parseFloat(item.penalInterest)}` },
        { label: 'Collected Mode', key: 'collectedMode' },
        { label: 'Reference No.', key: 'referenceNo' },
        { label: 'Wave-Off', key: (item: any) => `${parseFloat(item.waveOff)}` },
        { label: 'Settlement Amount', key: (item: any) => `${parseFloat(item.settelmentAmt)}` },
        { label: 'Collection Source', key: 'collectionSource' },
        { label: 'Collection Team', key: 'collectionTeam' },
        { label: 'Status', key: 'status' },
        { label: 'Remarks', key: 'remarks' },
        { label: 'Collection Date Time', key: 'collectionDateTime' },
      ];
      exportToExcel(filteredAndSortedData, headers as any, `Collection_Reports_${format(new Date(), 'yyyy-MM-dd')}`, 'Collection');
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
          <DataTableClearFiltersButton onClick={onClearFilters} />
        )}
      </div>
    </div>
  );
}

function DisbursedTable({ paginatedData, currentPage, itemsPerPage, handleSort, getSortIcon, openEditByLeadUuid, setDeleteTarget, actionCol }: any) {
  const tableColSpan = actionCol.showColumn ? 40 : 39;
  return (
    <Table>
      <TableHeader className={dataTableHeaderClass}>
        <TableRow className={dataTableHeaderRowClass}>
          <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
          <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('leadId')}>
            <div className="flex items-center">Lead ID {getSortIcon('leadId')}</div>
          </TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-center')}>Lead Coming Date</TableHead>
          <TableHead className={dataTableHeadClass}>Loan No.</TableHead>
          <TableHead className={dataTableHeadClass} onClick={() => handleSort('name')}>
            <div className="flex items-center">Name {getSortIcon('name')}</div>
          </TableHead>
          <TableHead className={dataTableHeadClass}>DOB</TableHead>
          <TableHead className={dataTableHeadClass}>Gender</TableHead>
          <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
          <TableHead className={dataTableHeadClass}>Aadhaar No.</TableHead>
          <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
          <TableHead className={dataTableHeadClass}>Email</TableHead>
          <TableHead className={dataTableHeadClass}>Branch</TableHead>
          <TableHead className={dataTableHeadClass}>Cred By</TableHead>
          <TableHead className={dataTableHeadClass}>PD By</TableHead>
          <TableHead className={dataTableHeadClass}>Employed</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Income</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Obligation</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Loan Amt.</TableHead>
          <TableHead className={dataTableHeadClass}>Tenure</TableHead>
          <TableHead className={dataTableHeadClass}>ROI</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-center')}>Status</TableHead>
          <TableHead className={dataTableHeadClass} onClick={() => handleSort('disbursalDate')}>
            <div className="flex items-center">Disbursal Date {getSortIcon('disbursalDate')}</div>
          </TableHead>
          <TableHead className={dataTableHeadClass}>Repay Date</TableHead>
          <TableHead className={dataTableHeadClass}>Residance</TableHead>
          <TableHead className={dataTableHeadClass}>Account No.</TableHead>
          <TableHead className={dataTableHeadClass}>IFSC</TableHead>
          <TableHead className={dataTableHeadClass}>Bank Name</TableHead>
          <TableHead className={dataTableHeadClass}>Acc Type</TableHead>
          <TableHead className={dataTableHeadClass}>Beneficiary Branch</TableHead>
          <TableHead className={dataTableHeadClass}>Check No</TableHead>
          <TableHead className={dataTableHeadClass}>E-nach</TableHead>
          <TableHead className={dataTableHeadClass}>Ref No.</TableHead>
          <TableHead className={dataTableHeadClass}>Company Account</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Fee</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Tax</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-center')}>CIBIL</TableHead>
          <TableHead className={dataTableHeadClass}>UTM</TableHead>
          <TableHead className={dataTableHeadClass}>State</TableHead>
          <TableHead className={dataTableHeadClass}>Red Flag</TableHead>
          <DataTableActionHead visible={actionCol.showColumn} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length > 0 ? (
          paginatedData.map((item: any, idx: number) => (
            <TableRow key={item.id} className={dataTableBodyRowClass}>
              <TableCell className={indexCellClass}>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
              <TableCell className={nameCellClass}>
                <DataTablePrimaryCell
                  label={item.leadId}
                  to={`/leads/all/${item.id}`}
                />
              </TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateTimeOrFallback(item.leadComingDate)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.loanNo}</TableCell>
              <TableCell className={nameCellClass}>
                <DataTableCustomerNameCell
                  label={formatPersonName(item.name)}
                  to={leadDetailsPath(item.id)}
                />
              </TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateOrFallback(item.dob)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.gender}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'uppercase')}>{item.pan}</TableCell>
              <TableCell className={dataTableCellClass}>{item.adharCard}</TableCell>
              <TableCell className={dataTableCellClass}>{item.mob}</TableCell>
              <TableCell className={dataTableCellClass}>{item.email}</TableCell>
              <TableCell className={dataTableCellClass}>{item.branch}</TableCell>
              <TableCell className={dataTableCellClass}>{formatPersonName(item.credBy)}</TableCell>
              <TableCell className={dataTableCellClass}>{formatPersonName(item.pdBy)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.employed}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.monthlyIncome)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.monthlyObligation)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.loanAmt)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.tenure}</TableCell>
              <TableCell className={dataTableCellClass}>{formatRatePercent(item.roi)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-center')}>
                <Badge className={leadPipelineStatusBadgeClass(item.status)}>{item.status}</Badge>
              </TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateField(item.disbursalDate)}</TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateOrFallback(item.repayDate)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.recidanceType}</TableCell>
              <TableCell className={dataTableCellClass}>{item.accountNo}</TableCell>
              <TableCell className={dataTableCellClass}>{item.bankIfsc}</TableCell>
              <TableCell className={dataTableCellClass}>{item.bankName}</TableCell>
              <TableCell className={dataTableCellClass}>{item.accountType}</TableCell>
              <TableCell className={dataTableCellClass}>{item.beneficiaryBranch || '—'}</TableCell>
              <TableCell className={dataTableCellClass}>{item.checkNo}</TableCell>
              <TableCell className={dataTableCellClass}>{item.enachDetails}</TableCell>
              <TableCell className={dataTableCellClass}>{item.disbursalRefNo}</TableCell>
              <TableCell className={dataTableCellClass}>{item.companyAccount || '—'}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.processingFee)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.tax)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-center')}>
                <CibilScoreBadge score={item.cibil} />
              </TableCell>
              <TableCell className={dataTableCellClass}>{item.utm}</TableCell>
              <TableCell className={dataTableCellClass}>{item.state}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-center')}>{item.redFlag}</TableCell>
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
          <EmptyState colSpan={tableColSpan} />
        )}
      </TableBody>
    </Table>
  );
}

function CollectionTable({ paginatedData, currentPage, itemsPerPage, handleSort, getSortIcon, openEditByLeadUuid, setDeleteTarget, actionCol }: any) {
  const tableColSpan = actionCol.showColumn ? 24 : 23;
  return (
    <Table>
      <TableHeader className={dataTableHeaderClass}>
        <TableRow className={dataTableHeaderRowClass}>
          <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
          <TableHead className={dataTableHeadClass}>Lead ID {getSortIcon('leadId')}</TableHead>
          <TableHead className={dataTableHeadClass}>Loan No.</TableHead>
          <TableHead className={dataTableHeadClass}>Branch</TableHead>
          <TableHead className={dataTableHeadClass} onClick={() => handleSort('name')}>
            <div className="flex items-center">Name {getSortIcon('name')}</div>
          </TableHead>
          <TableHead className={dataTableHeadClass}>Email</TableHead>
          <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
          <TableHead className={dataTableHeadClass}>PAN No.</TableHead>
          <TableHead className={dataTableHeadClass}>State</TableHead>
          <TableHead className={dataTableHeadClass} onClick={() => handleSort('repayDate')}>
            <div className="flex items-center">Repay Date {getSortIcon('repayDate')}</div>
          </TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Collected Amt.</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Principal</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Interest</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Penal</TableHead>
          <TableHead className={dataTableHeadClass}>Mode</TableHead>
          <TableHead className={dataTableHeadClass}>Ref No.</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Wave-off</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-right')}>Settlement</TableHead>
          <TableHead className={dataTableHeadClass}>Source</TableHead>
          <TableHead className={dataTableHeadClass}>Team</TableHead>
          <TableHead className={cn(dataTableHeadClass, 'text-center')}>Status</TableHead>
          <TableHead className={dataTableHeadClass}>Remarks</TableHead>
          <TableHead className={dataTableHeadClass}>Collection D&T</TableHead>
          <DataTableActionHead visible={actionCol.showColumn} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length > 0 ? (
          paginatedData.map((item: any, idx: number) => (
            <TableRow key={item.id} className={dataTableBodyRowClass}>
              <TableCell className={indexCellClass}>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
              <TableCell className={nameCellClass}>
                <DataTablePrimaryCell
                  label={item.leadId}
                  to={`/leads/all/${item.id}`}
                />
              </TableCell>
              <TableCell className={dataTableCellClass}>{item.loanNo}</TableCell>
              <TableCell className={dataTableCellClass}>{item.branch}</TableCell>
              <TableCell className={nameCellClass}>
                <DataTableCustomerNameCell
                  label={formatPersonName(item.name)}
                  to={leadDetailsPath(item.id)}
                />
              </TableCell>
              <TableCell className={dataTableCellClass}>{item.email}</TableCell>
              <TableCell className={dataTableCellClass}>{item.mob}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'uppercase')}>{item.pan}</TableCell>
              <TableCell className={dataTableCellClass}>{item.state}</TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateOrFallback(item.repayDate)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.collectedAmount)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.principalAmt)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.interestAmt)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.penalInterest)}</TableCell>
              <TableCell>
                <Badge className={badgeClass('neutral')}>{item.collectedMode}</Badge>
              </TableCell>
              <TableCell className={dataTableCellClass}>{item.referenceNo}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.waveOff)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-right')}>{parseFloat(item.settelmentAmt)}</TableCell>
              <TableCell className={dataTableCellClass}>{item.collectionSource}</TableCell>
              <TableCell className={dataTableCellClass}>{formatPersonName(item.collectionTeam)}</TableCell>
              <TableCell className={cn(dataTableCellClass, 'text-center')}>
                <Badge className={collectionStatusBadgeClass(item.status)}>{item.status}</Badge>
              </TableCell>
              <TableCell className={cn(dataTableCellClass, 'max-w-[150px] truncate')}>{item.remarks}</TableCell>
              <TableCell className={dataTableCellClass}>{formatAppDateTimeOrFallback(item.collectionDateTime)}</TableCell>
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
          <EmptyState colSpan={tableColSpan} />
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
