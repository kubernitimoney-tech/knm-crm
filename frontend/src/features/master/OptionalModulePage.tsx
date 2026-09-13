import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Search,
  RefreshCw,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button, buttonVariants } from '@/components/ui/button';
import { ExportButton } from '@/components/ui/ExportButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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
  dataTableDateRangeTriggerClass,
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
import { usePermissions } from '@/hooks/usePermissions';
import { Switch } from '@/components/ui/switch';
import { cn, exportRowsToExcel } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-picker';
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  startOfDay,
  endOfDay,
  isWithinInterval
} from 'date-fns';
import { formatAppDateTime, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface OptionalModule {
  id: string;
  name: string;
  status: boolean;
  updatedBy: string;
  updatedOn: string;
}

const MOCK_MODULES: OptionalModule[] = [
  { id: '1', name: 'Bulk SMS Integration', status: true, updatedBy: 'Admin User', updatedOn: '2024-03-20T10:30:00Z' },
  { id: '2', name: 'Email Notifications', status: true, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-19T14:45:00Z' },
  { id: '3', name: 'WhatsApp Business API', status: false, updatedBy: 'Admin User', updatedOn: '2024-03-18T09:15:00Z' },
  { id: '4', name: 'Third-Party KYC', status: false, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-17T16:20:00Z' },
  { id: '5', name: 'Automated Credit Score', status: true, updatedBy: 'Admin User', updatedOn: '2024-03-16T11:00:00Z' },
  { id: '6', name: 'Voice Call Reminders', status: false, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-15T12:00:00Z' },
  { id: '7', name: 'Document OCR', status: true, updatedBy: 'Admin User', updatedOn: '2024-03-14T15:30:00Z' },
  { id: '8', name: 'Geotagging Service', status: true, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-13T10:45:00Z' },
  { id: '9', name: 'Public Holiday Exclusion', status: true, updatedBy: 'Admin User', updatedOn: '2024-03-12T09:20:00Z' },
  { id: '10', name: 'Late Fee Automator', status: false, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-11T14:10:00Z' },
  { id: '11', name: 'Audit Log Archiver', status: true, updatedBy: 'Admin User', updatedOn: '2024-03-10T11:55:00Z' },
  { id: '12', name: 'Multi-Currency Support', status: false, updatedBy: 'Rajesh Kumar', updatedOn: '2024-03-09T16:35:00Z' },
];

export const OptionalModulePage = () => {
  useTitle('Optional Modules');
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const actionCol = useDataTableActionColumn({ edit: isSuperAdmin, delete: isSuperAdmin });
  const tableColSpan = actionCol.showColumn ? 6 : 5;
  const [modules, setModules] = useState<OptionalModule[]>(MOCK_MODULES);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'name',
    direction: 'asc'
  });

  const hasActiveFilters = searchQuery !== '' || dateFilter !== 'All Time' || statusFilter !== 'All Status';

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilter('All Time');
    setStatusFilter('All Status');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

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

  const toggleStatus = (id: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, status: !m.status, updatedOn: new Date().toISOString() } : m));
  };

  const filteredAndSorted = useMemo(() => {
    const result = modules.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'All Status' ||
        (statusFilter === 'Active' && m.status === true) ||
        (statusFilter === 'Disabled' && m.status === false);

      let matchesDate = true;
      const updatedDate = new Date(m.updatedOn);

      if (dateFilter === 'Today') {
        matchesDate = isWithinInterval(updatedDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = updatedDate >= subDays(new Date(), 7);
      } else if (dateFilter === 'Current Month') {
        matchesDate = updatedDate >= startOfMonth(new Date());
      } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(updatedDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }

      return matchesSearch && matchesDate && matchesStatus;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof OptionalModule];
        const bVal = b[sortConfig.key as keyof OptionalModule];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [modules, searchQuery, dateFilter, statusFilter, dateRange, sortConfig]);

  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = ['S.No', 'Module Name', 'Status', 'Updated By', 'Updated On'];
    const data = filteredAndSorted.map((m, index) => [
      index + 1,
      m.name,
      m.status ? 'Active' : 'Disabled',
      m.updatedBy,
      formatAppDateTime(m.updatedOn)
    ]);

    exportRowsToExcel(headers, data, `optional_modules_export_${format(new Date(), 'yyyy-MM-dd')}`);
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
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Optional Modules</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {isSuperAdmin && <ExportButton onClick={handleExport} />}
           <Button size="sm" className={dataTablePrimaryActionButtonClass}>
             <Plus className="w-4 h-4 mr-1" />
             Add New Module
           </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Modules')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className={cn('w-[140px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Status">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
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
                <TableHead className={cn(dataTableHeadClass, 'w-[80px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('name')}>
                  <div className="flex items-center">Module Name {getSortIcon('name')}</div>
                </TableHead>
                <TableHead className={cn(dataTableSortableHeadClass, 'text-center')} onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center">Status {getSortIcon('status')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('updatedBy')}>
                  <div className="flex items-center">Updated By {getSortIcon('updatedBy')}</div>
                </TableHead>
                <TableHead className={cn(dataTableSortableHeadClass, 'text-right')} onClick={() => handleSort('updatedOn')}>
                  <div className="flex items-center justify-end">Updated On {getSortIcon('updatedOn')}</div>
                </TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length > 0 ? (
                paginated.map((item, idx) => (
                  <TableRow key={item.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTablePrimaryCell label={item.name} tone="neutral" />
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <div className="flex items-center justify-center gap-3">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          item.status ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {item.status ? 'Active' : 'Disabled'}
                        </span>
                        <Switch
                          checked={item.status}
                          onCheckedChange={() => toggleStatus(item.id)}
                          className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                        />
                      </div>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.updatedBy}</TableCell>
                    <TableCell className={dataTableCellClass}>
                      {formatAppDateTimeOrFallback(item.updatedOn)}
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        onEdit={() => toggleStatus(item.id)}
                        onDelete={async () => {
                          setModules((prev) => prev.filter((m) => m.id !== item.id));
                        }}
                        deleteTitle="Delete module?"
                        deleteDescription={`${item.name} will be removed from the optional modules list.`}
                        editTitle="Toggle status"
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
                        <p className="text-sm font-black text-slate-900 tracking-tight">No modules found</p>
                        <p className="text-xs text-slate-400 font-medium">Try adjusting your filters or search query</p>
                      </div>
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
    </div>
  );
};
