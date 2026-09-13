import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
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
  TableRow
} from '@/components/ui/table';
import {
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
  dataTablePrimaryActionButtonClass,
  dataTableFilterControlClass,
  dataTableDateRangeTriggerClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import {
  DataTableListingActions,
  DataTableActionHead,
  useDataTableActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { usePermissions } from '@/hooks/usePermissions';
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  startOfDay,
  endOfDay,
  isWithinInterval
} from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn, exportRowsToExcel, formatCurrency, formatPersonName } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-picker';

interface ApprovalMatrix {
  id: string;
  department: string;
  designation: string;
  employeeName: string;
  minRange: number;
  maxRange: number;
  addedOn: string;
  status: 'Active' | 'Inactive';
}

const MOCK_MATRIX: ApprovalMatrix[] = [
  {
    id: '1',
    department: 'Credit',
    designation: 'Senior Credit Manager',
    employeeName: 'Anand Sharma',
    minRange: 1000000,
    maxRange: 5000000,
    addedOn: '2024-01-10T10:00:00Z',
    status: 'Active'
  },
  {
    id: '2',
    department: 'Risk',
    designation: 'Head of Risk',
    employeeName: 'Priya Verma',
    minRange: 5000000,
    maxRange: 20000000,
    addedOn: '2024-01-15T14:30:00Z',
    status: 'Active'
  },
  {
    id: '3',
    department: 'Retail',
    designation: 'Zonal Manager',
    employeeName: 'Karan Malhotra',
    minRange: 500000,
    maxRange: 2500000,
    addedOn: '2024-02-01T09:15:00Z',
    status: 'Inactive'
  },
  {
    id: '4',
    department: 'Operations',
    designation: 'Operations Lead',
    employeeName: 'Sunita Gill',
    minRange: 0,
    maxRange: 1000000,
    addedOn: '2024-02-10T16:45:00Z',
    status: 'Active'
  },
  {
    id: '5',
    department: 'Compliance',
    designation: 'Compliance Officer',
    employeeName: 'Vikram Singh',
    minRange: 200000,
    maxRange: 500000,
    addedOn: '2024-02-15T11:00:00Z',
    status: 'Active'
  },
  {
    id: '6',
    department: 'Credit',
    designation: 'Junior Credit Analyst',
    employeeName: 'Meera Das',
    minRange: 0,
    maxRange: 500000,
    addedOn: '2024-02-20T14:00:00Z',
    status: 'Active'
  },
];

export const ApprovalMatrixPage = () => {
  useTitle('Approval Matrix');
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const actionCol = useDataTableActionColumn({ edit: isSuperAdmin, delete: isSuperAdmin });
  const tableColSpan = actionCol.showColumn ? 8 : 7;
  const [matrixData, setMatrixData] = useState<ApprovalMatrix[]>(MOCK_MATRIX);
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
    key: 'department',
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

  const filteredAndSorted = useMemo(() => {
    const result = [...matrixData].filter(m => {
      const matchesSearch =
        m.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'All Status' || m.status === statusFilter;

      let matchesDate = true;
      const addedDate = new Date(m.addedOn);

      if (dateFilter === 'Today') {
        matchesDate = isWithinInterval(addedDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date())
        });
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = addedDate >= subDays(new Date(), 7);
      } else if (dateFilter === 'Current Month') {
        matchesDate = addedDate >= startOfMonth(new Date());
      } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(addedDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }

      return matchesSearch && matchesDate && matchesStatus;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof ApprovalMatrix];
        const bVal = b[sortConfig.key as keyof ApprovalMatrix];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [matrixData, searchQuery, dateFilter, statusFilter, dateRange, sortConfig]);

  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = ['Department', 'Designation', 'Employee Name', 'Min Range', 'Max Range', 'Status', 'Added On'];
    const data = filteredAndSorted.map(item => [
      item.department,
      item.designation,
      item.employeeName,
      item.minRange,
      item.maxRange,
      item.status,
      format(new Date(item.addedOn), 'yyyy-MM-dd')
    ]);

    exportRowsToExcel(headers, data, `approval_matrix_export_${format(new Date(), 'yyyy-MM-dd')}`);
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
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Approval Matrix</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {isSuperAdmin && <ExportButton onClick={handleExport} />}
           <Button
             size="sm"
             onClick={() => navigate('/master/approval-matrix/new')}
             className={dataTablePrimaryActionButtonClass}
           >
             <Plus className="w-4 h-4 mr-1" />
             Add Matrix entry
           </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Employee or Department')}
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
                <SelectItem value="Inactive">Inactive</SelectItem>
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
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('department')}>
                  <div className="flex items-center">Department {getSortIcon('department')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('designation')}>
                  <div className="flex items-center">Designation {getSortIcon('designation')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('employeeName')}>
                  <div className="flex items-center">Employee {getSortIcon('employeeName')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('maxRange')}>
                  <div className="flex items-center">Range (Min - Max) {getSortIcon('maxRange')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('addedOn')}>
                  <div className="flex items-center">Added On {getSortIcon('addedOn')}</div>
                </TableHead>
                <TableHead className={cn(dataTableHeadClass, 'w-[100px] text-center')}>Status</TableHead>
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
                    <TableCell className={dataTableCellClass}>
                      <Badge variant="info" className="border-slate-200 text-slate-600 bg-white font-black text-[10px] tracking-widest uppercase">
                        {item.department}
                      </Badge>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.designation}</TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell label={formatPersonName(item.employeeName)} tone="neutral" />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      <div className="flex items-center gap-2">
                         <span>{formatCurrency(item.minRange)}</span>
                         <div className="h-px w-3 bg-slate-200" />
                         <span>{formatCurrency(item.maxRange)}</span>
                      </div>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{formatAppDateTimeOrFallback(item.addedOn)}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <div className="flex justify-center">
                        <Badge className={cn(
                          "font-black text-[10px] tracking-widest border-none px-3 py-1",
                          item.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        onEdit={() => {}}
                        onDelete={async () => {
                          setMatrixData((prev) => prev.filter((row) => row.id !== item.id));
                        }}
                        deleteTitle="Delete approval matrix entry?"
                        deleteDescription={`This will permanently delete the approval matrix entry for ${item.employeeName}. This action cannot be undone.`}
                        deleteConfirmLabel="Delete entry"
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
                        <p className="text-sm font-black text-slate-900 tracking-tight">No approval matrix entries found</p>
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
