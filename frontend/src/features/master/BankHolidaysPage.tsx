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
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableActionCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableSortableHeadClass,
  indexCellClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  dataTablePrimaryActionButtonClass,
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
import { format } from 'date-fns';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { AppSelect } from '@/components/ui/app-select';
import { BankHolidayFormDialog } from './components/BankHolidayFormDialog';
import {
  deleteBankHoliday,
  fetchBankHolidays,
  type BankHoliday,
} from '@/lib/bankHolidaysApi';
import {
  buildBankHolidayFinancialYearOptions,
  defaultBankHolidayFinancialYearStart,
  formatFinancialYearLabel,
} from '@/lib/financialYear';
import { exportRowsToExcel, cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const ALL_FINANCIAL_YEARS = 'all';

export const BankHolidaysPage = () => {
  useTitle('Bank Holidays');
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const actionCol = useDataTableActionColumn({ edit: isSuperAdmin, delete: isSuperAdmin });
  const tableColSpan = actionCol.showColumn ? 6 : 5;

  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const defaultFinancialYear = defaultBankHolidayFinancialYearStart();
  const [financialYearFilter, setFinancialYearFilter] = useState(String(defaultFinancialYear));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'holidayDate',
    direction: 'asc',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<BankHoliday | null>(null);

  const yearOptions = useMemo(() => buildBankHolidayFinancialYearOptions(), []);

  const financialYearSelectOptions = useMemo(
    () => [
      { value: ALL_FINANCIAL_YEARS, label: 'All Years' },
      ...yearOptions.map((year) => ({
        value: String(year),
        label: `FY ${formatFinancialYearLabel(year)}`,
      })),
    ],
    [yearOptions],
  );

  const loadHolidays = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params: { financial_year?: number; search?: string } = {};
      if (financialYearFilter !== ALL_FINANCIAL_YEARS) {
        params.financial_year = Number(financialYearFilter);
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await fetchBankHolidays(params);
      setHolidays(data);
    } catch (err) {
      setHolidays([]);
      setLoadError(err instanceof Error ? err.message : 'Failed to load bank holidays.');
    } finally {
      setIsLoading(false);
    }
  }, [financialYearFilter, searchQuery]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const hasActiveFilters = searchQuery !== '' || financialYearFilter !== String(defaultFinancialYear);

  const handleClearFilters = () => {
    setSearchQuery('');
    setFinancialYearFilter(String(defaultFinancialYear));
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
    const result = [...holidays];

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof BankHoliday];
        const bVal = b[sortConfig.key as keyof BankHoliday];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [holidays, sortConfig]);

  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleExport = () => {
    const headers = ['S.No', 'Holiday Date', 'Holiday Name', 'Financial Year', 'Added On'];
    const data = filteredAndSorted.map((row, index) => [
      index + 1,
      formatAppDateOrFallback(row.holidayDate),
      row.holidayName,
      `FY ${row.financialYearDisplay}`,
      format(new Date(row.addedOn), 'yyyy-MM-dd'),
    ]);

    exportRowsToExcel(headers, data, `bank_holidays_export_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const openCreateForm = () => {
    setEditingHoliday(null);
    setFormOpen(true);
  };

  const openEditForm = (holiday: BankHoliday) => {
    setEditingHoliday(holiday);
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
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Bank Holidays</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium pl-[52px]">
            RBI bank holidays by financial year (April–March)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && <ExportButton onClick={handleExport} />}
          <Button
            size="sm"
            onClick={openCreateForm}
            className={dataTablePrimaryActionButtonClass}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Holiday
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
            placeholder={searchPlaceholder('Holiday Name')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <AppSelect
              value={financialYearFilter}
              onValueChange={(value) => {
                setFinancialYearFilter(value);
                setCurrentPage(1);
              }}
              placeholder={selectPlaceholder('Financial Year')}
              options={financialYearSelectOptions}
              triggerClassName="w-[148px]"
            />

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
                  <TableHead className={cn(dataTableHeadClass, 'w-[80px] pl-4 text-center')}>
                    S.No
                  </TableHead>
                  <TableHead
                    className={dataTableSortableHeadClass}
                    onClick={() => handleSort('holidayDate')}
                  >
                    <div className="flex items-center">Holiday Date {getSortIcon('holidayDate')}</div>
                  </TableHead>
                  <TableHead
                    className={dataTableSortableHeadClass}
                    onClick={() => handleSort('holidayName')}
                  >
                    <div className="flex items-center">Holiday Name {getSortIcon('holidayName')}</div>
                  </TableHead>
                  <TableHead
                    className={dataTableSortableHeadClass}
                    onClick={() => handleSort('financialYearStart')}
                  >
                    <div className="flex items-center">
                      Financial Year {getSortIcon('financialYearStart')}
                    </div>
                  </TableHead>
                  <TableHead
                    className={dataTableSortableHeadClass}
                    onClick={() => handleSort('addedOn')}
                  >
                    <div className="flex items-center">Added On {getSortIcon('addedOn')}</div>
                  </TableHead>
                  <DataTableActionHead visible={actionCol.showColumn} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoadingRow colSpan={tableColSpan} message="Loading bank holidays…" />
                ) : paginated.length > 0 ? (
                  paginated.map((item, idx) => (
                    <TableRow key={item.id} className={dataTableBodyRowClass}>
                      <TableCell className={indexCellClass}>
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        {formatAppDateOrFallback(item.holidayDate)}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        {item.holidayName}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        FY {item.financialYearDisplay}
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
                              await deleteBankHoliday(item.id);
                              await loadHolidays();
                            }}
                            deleteTitle="Delete bank holiday?"
                            deleteDescription={`This will permanently delete "${item.holidayName}" on ${formatAppDateOrFallback(item.holidayDate)}.`}
                            deleteConfirmLabel="Delete holiday"
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
                            No bank holidays found
                          </p>
                          <p className="text-xs text-slate-400 font-medium">
                            Add an RBI holiday or adjust your filters
                          </p>
                        </div>
                        {!hasActiveFilters && (
                          <Button
                            size="sm"
                            onClick={openCreateForm}
                            className={cn(dataTablePrimaryActionButtonClass, 'mt-2')}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Holiday
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

      <BankHolidayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingHoliday={editingHoliday}
        onSaved={loadHolidays}
      />
    </div>
  );
};
