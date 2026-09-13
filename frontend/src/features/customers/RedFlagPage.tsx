import React, { useState, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { ExportButton } from '@/components/ui/ExportButton';
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
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { SanctionLead } from '@/types';
import { cn, exportRowsToExcel, formatPersonName } from '@/lib/utils';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { buttonVariants } from '@/components/ui/button';
import { usePipelineRows } from '@/hooks/usePipelineRows';
import { useLeadListingActions } from '@/hooks/useLeadListingActions';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder } from '@/lib/placeholders';

export const RedFlagPage = () => {
  useTitle('Red Flag Customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'date',
    direction: 'desc'
  });
  const { rows: redFlagRows, isLoading, refetch } = usePipelineRows('red-flag');
  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: refetch,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = actionCol.showColumn ? 7 : 6;

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

  // Filtering & Sorting Logic
  const filteredAndSorted = useMemo(() => {
    const result = redFlagRows.filter(lead => {
      const matchesSearch =
        lead.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobile.includes(searchQuery) ||
        lead.leadId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
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
  }, [redFlagRows, searchQuery, sortConfig]);

  // Pagination Logic
  const paginated = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = ['S.No', 'Lead ID', 'Name', 'Mobile', 'Reason', 'Date'];
    const data = filteredAndSorted.map((lead, index) => [
      index + 1,
      lead.leadId,
      lead.customerName,
      lead.mobile,
      lead.redFlagReason,
      lead.date
    ]);

    exportRowsToExcel(headers, data, `red_flag_customers_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Red Flag Customers</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">High-risk profiles requiring extreme caution</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton permission="redflag.export" onClick={handleExport} />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Mobile', 'or Lead ID')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {searchQuery !== '' && (
              <DataTableClearFiltersButton onClick={() => { setSearchQuery(''); setCurrentPage(1); }} />
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
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={dataTableHeadClass}>Reason</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('date')}>
                  <div className="flex items-center justify-end">Date {getSortIcon('date')}</div>
                </TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading red flag accounts…" />
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
                    <TableCell className={dataTableCellClass}>
                      <Badge variant="danger">{lead.redFlagReason}</Badge>
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
                    <p className="text-slate-400 font-bold text-sm">No red flag records found</p>
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
      {leadActionDialogs}
    </div>
  );
};
