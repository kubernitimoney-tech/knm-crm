import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DataTableFooter,
  DataTablePageSizeSelect,
  DataTablePrimaryCell,
  dataTableBodyRowClass,
  dataTableCardClass,
  dataTableCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableStackClass,
  dataTableWrapperClass,
  indexCellClass,
  nameCellClass,
} from '@/components/ui/data-table';
import { formatAppDateOrFallback } from '@/lib/dateUtils';
import { leadDetailsPath, type LeadListReturnTo } from '@/lib/leadNavigation';
import type { PreviousLeadRow } from '@/lib/leadsApi';
import { leadPipelineStatusBadgeClass } from '@/lib/badgeStyles';
import { cn, formatCurrency } from '@/lib/utils';

interface PreviousLeadsTableProps {
  leads: PreviousLeadRow[];
  emptyMessage?: string;
  listReturnTo?: LeadListReturnTo;
}

function formatRoi(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}%`;
}

export function PreviousLeadsTable({
  leads,
  emptyMessage = 'No previous leads found for this customer',
  listReturnTo,
}: PreviousLeadsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalPages = Math.max(1, Math.ceil(leads.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [leads.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return leads.slice(start, start + itemsPerPage);
  }, [leads, currentPage, itemsPerPage]);

  if (leads.length === 0) {
    return (
      <Card className={cn('px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400', dataTableCardClass)}>
        {emptyMessage}
      </Card>
    );
  }

  return (
    <div className={dataTableStackClass}>
      <Card className={dataTableCardClass}>
        <div className={dataTableWrapperClass}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={dataTableHeadClass}>S.No</TableHead>
                <TableHead className={dataTableHeadClass}>Lead ID</TableHead>
                <TableHead className={dataTableHeadClass}>Status</TableHead>
                <TableHead className={dataTableHeadClass}>Loan Amount</TableHead>
                <TableHead className={dataTableHeadClass}>Processing Fee</TableHead>
                <TableHead className={dataTableHeadClass}>ROI</TableHead>
                <TableHead className={dataTableHeadClass}>Sanction Date</TableHead>
                <TableHead className={dataTableHeadClass}>Last Payment Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead, index) => (
                <TableRow key={lead.id} className={dataTableBodyRowClass}>
                  <TableCell className={indexCellClass}>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell className={nameCellClass}>
                    <DataTablePrimaryCell
                      label={lead.leadId}
                      to={leadDetailsPath(lead.id, listReturnTo ?? { type: 'all-leads' })}
                    />
                  </TableCell>
                  <TableCell className={dataTableCellClass}>
                    <Badge className={leadPipelineStatusBadgeClass(lead.pipelineStatus || '—')}>
                      {lead.pipelineStatus || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(dataTableCellClass, 'font-semibold tabular-nums')}>
                    {lead.loanAmount != null ? formatCurrency(lead.loanAmount) : '—'}
                  </TableCell>
                  <TableCell className={cn(dataTableCellClass, 'tabular-nums')}>
                    {lead.processingFee != null ? formatCurrency(lead.processingFee) : '—'}
                  </TableCell>
                  <TableCell className={cn(dataTableCellClass, 'tabular-nums')}>
                    {formatRoi(lead.roi)}
                  </TableCell>
                  <TableCell className={dataTableCellClass}>
                    {formatAppDateOrFallback(lead.sanctionDate, '—')}
                  </TableCell>
                  <TableCell className={dataTableCellClass}>
                    {formatAppDateOrFallback(lead.lastPaymentDate, '—')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <DataTableFooter
        inset={false}
        currentPage={currentPage}
        totalItems={leads.length}
        pageSize={itemsPerPage}
        onPageChange={setCurrentPage}
        leftExtra={
          <DataTablePageSizeSelect
            value={itemsPerPage}
            onChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
            options={[10, 20, 25, 50, 100]}
          />
        }
      />
    </div>
  );
}
