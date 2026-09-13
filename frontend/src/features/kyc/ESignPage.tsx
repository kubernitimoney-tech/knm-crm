import React, { useState, useMemo, useEffect } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
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
  DataTableCustomerNameCell,
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableActionCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  indexCellClass,
  nameCellClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  dataTableFilterControlClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { cn, exportToExcel, formatPersonName } from '@/lib/utils';
import { fetchEsignRows, type EsignRow } from '@/lib/pipelineApi';
import { toast } from '@/components/ui/toast';
import { leadDetailsPath } from '@/lib/leadNavigation';
import { useLeadListingActions } from '@/hooks/useLeadListingActions';
import {
  DataTableListingActions,
  DataTableActionHead,
  useLeadListingActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export function ESignPage() {
  useTitle('E-Sign');
  const [data, setData] = useState<EsignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const reloadData = () => {
    fetchEsignRows().then(setData).catch(() => {
      toast({ title: 'Failed to load e-sign requests', variant: 'error' });
    });
  };

  const { openEditByLeadUuid, setDeleteTarget, dialogs: leadActionDialogs } = useLeadListingActions({
    onDeleted: reloadData,
  });
  const actionCol = useLeadListingActionColumn();
  const tableColSpan = actionCol.showColumn ? 10 : 9;

  useEffect(() => {
    fetchEsignRows()
      .then(setData)
      .catch(() => {
        setData([]);
        toast({ title: 'Failed to load e-sign requests', variant: 'error' });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggleResend = (id: string) => {
    setData(prev => prev.map(item =>
      item.id === id ? { ...item, resend: !item.resend } : item
    ));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mob.includes(searchQuery);

      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, statusFilter]);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const headers = [
      { label: 'S.No', key: (_: any, idx: number) => idx + 1 },
      { label: 'Name', key: 'name' },
      { label: 'Email Address', key: 'email' },
      { label: 'Mobile No.', key: 'mob' },
      { label: 'Loan Amt.', key: (item: any) => `${parseFloat(item.loanAmt)}` },
      { label: 'Requested By', key: 'requestedBy' },
      { label: 'Status', key: 'status' },
      { label: 'Resend (Yes/No)', key: (item: any) => item.resend ? 'Yes' : 'No' }
    ];
    exportToExcel(filteredData, headers, `ESign_Status_${new Date().toISOString().split('T')[0]}`, 'E-Sign');
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">E-Sign</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">Track and manage digital signature requests</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} permission="application.view" />
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Email', 'Mobile')}
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
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery !== '' || statusFilter !== 'All') && (
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
                <TableHead className={dataTableHeadClass}>Name</TableHead>
                <TableHead className={dataTableHeadClass}>Email Address</TableHead>
                <TableHead className={dataTableHeadClass}>Mobile No.</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Loan Amt.</TableHead>
                <TableHead className={dataTableHeadClass}>Requested By</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>Status</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'w-[120px] text-center')}>Resend</TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading e-sign requests…" />
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <TableRow key={item.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell label={formatPersonName(item.name)} />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.email}</TableCell>
                    <TableCell className={dataTableCellClass}>{item.mob}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      {parseFloat(item.loanAmt)}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{formatPersonName(item.requestedBy)}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <Badge
                        variant={item.status === 'signed' ? 'success' : 'danger'}
                        className="text-[9px] font-black uppercase"
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={dataTableActionCellClass}>
                      <button
                        onClick={() => handleToggleResend(item.id)}
                        className={cn(
                          "relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none",
                          item.resend ? "bg-emerald-500" : "bg-rose-600"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out px-0.5 flex items-center justify-center",
                            item.resend ? "translate-x-7" : "translate-x-1"
                          )}
                        >
                          <span className={cn(
                            "text-[6px] font-black uppercase",
                            item.resend ? "text-emerald-500" : "text-rose-600"
                          )}>
                            {item.resend ? "Y" : "N"}
                          </span>
                        </span>
                        <span className={cn(
                          "absolute text-[9px] font-black uppercase transition-opacity duration-200",
                          item.resend ? "left-2 text-white opacity-100" : "right-2 text-rose-100 opacity-0"
                        )}>
                          Yes
                        </span>
                        <span className={cn(
                          "absolute text-[9px] font-black uppercase transition-opacity duration-200",
                          item.resend ? "left-2 text-emerald-100 opacity-0" : "right-2 text-white opacity-100"
                        )}>
                          No
                        </span>
                      </button>
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={leadDetailsPath(item.leadUuid)}
                        onEdit={() => openEditByLeadUuid(item.leadUuid)}
                        onDelete={() => setDeleteTarget({ id: item.leadUuid, leadId: item.leadId })}
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
          totalItems={filteredData.length}
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
}
