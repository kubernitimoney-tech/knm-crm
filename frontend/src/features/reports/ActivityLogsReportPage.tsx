import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RowDeleteButton } from '@/components/ui/data-table-row-action-buttons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableAreaLoader,
} from '@/components/ui/table';
import {
  DataTableFooter,
  DataTablePageSizeSelect,
  DataTableSearchInput,
  dataTableActionCellClass,
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  indexCellClass,
  dataTableWrapperClass,
} from '@/components/ui/data-table';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ACTIVITY_LOG_FETCHERS,
  deleteActivityLogRow,
  type ActivityLogTab,
} from '@/lib/activityLogsApi';
import { searchPlaceholder } from '@/lib/placeholders';

const TAB_ITEMS = [
  { value: 'user-activity', label: 'User Activity' },
  { value: 'audit-logs', label: 'Audit Logs' },
  { value: 'call-logs', label: 'Call Logs' },
  { value: 'lead-activity', label: 'Lead Activity' },
  { value: 'collection-activity', label: 'Collection Activity' },
] as const;

type ActivityRow = Record<string, string>;

const TAB_COLUMNS: Record<ActivityLogTab, { key: string; label: string }[]> = {
  'user-activity': [
    { key: 'userName', label: 'User' },
    { key: 'userEmail', label: 'Email' },
    { key: 'action', label: 'Action' },
    { key: 'description', label: 'Description' },
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'createdAt', label: 'Timestamp' },
  ],
  'audit-logs': [
    { key: 'userName', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'modelName', label: 'Model' },
    { key: 'objectId', label: 'Object ID' },
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'createdAt', label: 'Timestamp' },
  ],
  'call-logs': [
    { key: 'leadCode', label: 'Lead ID' },
    { key: 'disposition', label: 'Disposition' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'loggedBy', label: 'Logged By' },
    { key: 'createdAt', label: 'Timestamp' },
  ],
  'lead-activity': [
    { key: 'leadCode', label: 'Lead ID' },
    { key: 'activityType', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'createdAt', label: 'Timestamp' },
  ],
  'collection-activity': [
    { key: 'loanAccount', label: 'Loan Account' },
    { key: 'customerName', label: 'Customer' },
    { key: 'activityType', label: 'Type' },
    { key: 'outcome', label: 'Outcome' },
    { key: 'notes', label: 'Notes' },
    { key: 'performedBy', label: 'Performed By' },
    { key: 'performedAt', label: 'Timestamp' },
  ],
};

const LONG_TEXT_COLUMN_KEYS = new Set(['remarks', 'description', 'notes']);
const EMPTY_CELL = '-';

function formatCellValue(key: string, value: string): string {
  if (key === 'createdAt' || key === 'performedAt') {
    return formatAppDateTimeOrFallback(value, EMPTY_CELL);
  }
  return value || EMPTY_CELL;
}

function renderCellContent(key: string, value: string): React.ReactNode {
  const display = formatCellValue(key, value);
  if (display === EMPTY_CELL || !LONG_TEXT_COLUMN_KEYS.has(key)) {
    return display;
  }

  return (
    <span
      className="block max-w-[220px] sm:max-w-[280px] line-clamp-2 whitespace-normal break-words text-left"
      title={display}
    >
      {display}
    </span>
  );
}

function rowLabel(row: ActivityRow): string {
  return row.description || row.leadCode || row.loanAccount || row.action || row.id || 'this record';
}

export function ActivityLogsReportPage() {
  useTitle('Activity Logs');
  const { canUi } = usePermissions();
  const canDeleteLogs = canUi('activityLogs', 'log', 'delete');

  const [activeTab, setActiveTab] = useState<ActivityLogTab>('user-activity');
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetcher = ACTIVITY_LOG_FETCHERS[activeTab];
      const payload = await fetcher({ page: currentPage, page_size: itemsPerPage });
      setRows((Array.isArray(payload.results) ? payload.results : []) as unknown as ActivityRow[]);
      setTotalCount(payload.count ?? 0);
    } catch {
      toast({ title: 'Failed to load activity logs', variant: 'error' });
      setRows([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, itemsPerPage]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }, [rows, searchQuery]);

  const columns = TAB_COLUMNS[activeTab];

  const deleteDescription = deleteTarget
    ? `This will permanently remove "${rowLabel(deleteTarget)}". This action cannot be undone.`
    : 'This will permanently remove this record. This action cannot be undone.';

  const handleTabChange = (value: string) => {
    setActiveTab(value as ActivityLogTab);
    setCurrentPage(1);
    setSearchQuery('');
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      await deleteActivityLogRow(activeTab, deleteTarget.id);
      toast({ title: 'Activity log record deleted', variant: 'success' });
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast({
        title: 'Failed to delete record',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div>
        <Breadcrumbs />
        <h1 className="text-[22px] font-black text-primary-deep leading-tight">Activity Logs</h1>
        <p className="text-mid-shade text-xs mt-1 font-medium italic">
          User sessions, audit trail, call logs, lead activity, and collection outreach
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <ResponsiveTabsNav
          items={TAB_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
          value={activeTab}
          onValueChange={handleTabChange}
        />

        {TAB_ITEMS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 space-y-3">
            <Card className={dataTableCardClass}>
              <div className={dataTableFilterToolbarClass}>
                <DataTableSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={searchPlaceholder('activity logs')}
                  className="max-w-sm"
                />
              </div>

              <div className={cn('relative', dataTableWrapperClass)}>
                {isLoading ? <TableAreaLoader /> : null}
                <Table>
                  <TableHeader className={dataTableHeaderClass}>
                    <TableRow className={dataTableHeaderRowClass}>
                      <TableHead className={cn(dataTableHeadClass, indexCellClass)}>#</TableHead>
                      {columns.map((column) => (
                        <TableHead
                          key={column.key}
                          className={cn(
                            dataTableHeadClass,
                            LONG_TEXT_COLUMN_KEYS.has(column.key) && 'max-w-[220px] sm:max-w-[280px]',
                          )}
                        >
                          {column.label}
                        </TableHead>
                      ))}
                      {canDeleteLogs ? (
                        <TableHead className={cn(dataTableHeadClass, 'text-center w-[72px]')}>
                          Action
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 && !isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length + 1 + (canDeleteLogs ? 1 : 0)}
                          className="text-center py-10 text-sm text-mid-shade"
                        >
                          No activity records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row, index) => (
                        <TableRow key={row.id ?? `${tab.value}-${index}`} className={dataTableBodyRowClass}>
                          <TableCell className={cn(dataTableCellClass, indexCellClass)}>
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </TableCell>
                          {columns.map((column) => (
                            <TableCell
                              key={column.key}
                              className={cn(
                                dataTableCellClass,
                                LONG_TEXT_COLUMN_KEYS.has(column.key) && 'max-w-[220px] sm:max-w-[280px] align-top',
                              )}
                            >
                              {renderCellContent(column.key, row[column.key] ?? '')}
                            </TableCell>
                          ))}
                          {canDeleteLogs ? (
                            <TableCell className={dataTableActionCellClass}>
                              <RowDeleteButton
                                aria-label="Delete activity log record"
                                onClick={() => setDeleteTarget(row)}
                              />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <DataTableFooter
                inset={false}
                currentPage={currentPage}
                totalItems={searchQuery.trim() ? filteredRows.length : totalCount}
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
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete activity log record?"
        description={deleteDescription}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
