import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ui/ExportButton';
import { AppSelect } from '@/components/ui/app-select';
import { toast } from '@/components/ui/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableLoadingRow,
  TableRow,
} from '@/components/ui/table';
import {
  dataTableBodyRowClass,
  dataTableCardClass,
  dataTableCellClass,
  dataTableFilterToolbarClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  dataTablePrimaryActionButtonClass,
  DataTableClearFiltersButton,
  DataTableFilterPill,
  DataTableFooter,
  DataTablePageSizeSelect,
  DataTableSearchInput,
} from '@/components/ui/data-table';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { getApiErrorMessage } from '@/lib/api';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import {
  ACTIVE_TICKET_STATUSES,
  downloadTicketsCsv,
  fetchTickets,
  fetchTicketSummary,
  TICKET_DEPARTMENT_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  type TicketListItem,
  type TicketListParams,
  type TicketSummary,
} from '@/lib/helpdeskApi';
import { RaiseTicketDialog } from './components/RaiseTicketDialog';
import { autoCloseHint, ticketPriorityBadgeClass, ticketStatusBadgeClass } from './ticketStyles';

type Mode = 'mine' | 'queue';

interface Pill {
  key: string;
  label: string;
  params: TicketListParams;
  count: (summary: TicketSummary) => number | undefined;
}

const sum = (summary: TicketSummary, statuses: string[]) =>
  statuses.reduce((total, s) => total + (summary.by_status[s as keyof TicketSummary['by_status']] ?? 0), 0);

const ACTIVE = ACTIVE_TICKET_STATUSES.join(',');

const PILLS: Record<Mode, Pill[]> = {
  mine: [
    { key: 'active', label: 'In Progress', params: { status: ACTIVE }, count: (s) => sum(s, ACTIVE_TICKET_STATUSES) },
    { key: 'resolved', label: 'Awaiting My Confirmation', params: { status: 'resolved' }, count: (s) => s.by_status.resolved },
    { key: 'closed', label: 'Closed', params: { status: 'closed,cancelled' }, count: (s) => sum(s, ['closed', 'cancelled']) },
    { key: 'all', label: 'All', params: {}, count: (s) => sum(s, Object.keys(s.by_status)) },
  ],
  queue: [
    { key: 'unassigned', label: 'Unassigned', params: { status: 'open', assigned_to: 'none' }, count: (s) => s.unassigned },
    { key: 'assigned', label: 'Assigned To Me', params: { status: ACTIVE, assigned_to: 'me' }, count: (s) => s.assigned_to_me_open },
    { key: 'active', label: 'All Active', params: { status: ACTIVE }, count: (s) => sum(s, ACTIVE_TICKET_STATUSES) },
    { key: 'reopened', label: 'Reopened', params: { status: 'reopened' }, count: (s) => s.by_status.reopened },
    { key: 'resolved', label: 'Resolved', params: { status: 'resolved' }, count: (s) => s.by_status.resolved },
    { key: 'closed', label: 'Closed', params: { status: 'closed,cancelled' }, count: (s) => sum(s, ['closed', 'cancelled']) },
    { key: 'all', label: 'All', params: {}, count: (s) => sum(s, Object.keys(s.by_status)) },
  ],
};

const ALL = 'all';

export function HelpdeskTicketsPage({ mode }: { mode: Mode }) {
  const isQueue = mode === 'queue';
  useTitle(isQueue ? 'IT Queue' : 'My Tickets');
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canRaise = hasPermission('ticket.create');

  const [rows, setRows] = useState<TicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pillKey, setPillKey] = useState(PILLS[mode][0].key);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [raiseOpen, setRaiseOpen] = useState(false);

  // Reset filters when switching between My Tickets and IT Queue (same component).
  useEffect(() => {
    setPillKey(PILLS[mode][0].key);
    setPage(1);
  }, [mode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo<TicketListParams>(() => {
    const pill = PILLS[mode].find((p) => p.key === pillKey) ?? PILLS[mode][0];
    return {
      ...pill.params,
      mine: !isQueue,
      search: search || undefined,
      department: department !== ALL ? department : undefined,
      priority: priority !== ALL ? priority : undefined,
    };
  }, [mode, pillKey, isQueue, search, department, priority]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [data, counts] = await Promise.all([
        fetchTickets({ ...params, page, page_size: pageSize }),
        fetchTicketSummary(!isQueue),
      ]);
      setRows(data.results);
      setTotal(data.count);
      setSummary(counts);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params, page, pageSize, isQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = searchInput !== '' || department !== ALL || priority !== ALL;
  const clearFilters = () => {
    setSearchInput('');
    setDepartment(ALL);
    setPriority(ALL);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      await downloadTicketsCsv(params);
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'error' });
    }
  };

  const colSpan = 7;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep tracking-tight">
            {isQueue ? 'IT Queue' : 'My Tickets'}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            {isQueue
              ? 'Tickets raised by the team. Pick one up, fix it in the portal, and resolve with a remark.'
              : 'Issues you raised with IT Support. Confirm or reopen once they are resolved.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isQueue && <ExportButton label="Export CSV" permission="ticket.export" onClick={handleExport} />}
          {canRaise && (
            <Button size="sm" onClick={() => setRaiseOpen(true)} className={dataTablePrimaryActionButtonClass}>
              <Plus className="w-4 h-4 mr-1" />
              Raise Ticket
            </Button>
          )}
        </div>
      </div>

      {!isQueue && summary && summary.awaiting_my_confirmation > 0 && pillKey !== 'resolved' && (
        <button
          type="button"
          onClick={() => {
            setPillKey('resolved');
            setPage(1);
          }}
          className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200"
        >
          {summary.awaiting_my_confirmation} resolved ticket
          {summary.awaiting_my_confirmation === 1 ? ' is' : 's are'} waiting for your confirmation.
          Unconfirmed tickets auto-close after 3 working days.
        </button>
      )}

      {loadError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {loadError}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PILLS[mode].map((pill) => (
            <DataTableFilterPill
              key={pill.key}
              label={pill.label}
              count={summary ? pill.count(summary) : undefined}
              active={pill.key === pillKey}
              onClick={() => {
                setPillKey(pill.key);
                setPage(1);
              }}
            />
          ))}
        </div>

        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Ticket No, Subject, Reference')}
            value={searchInput}
            onChange={setSearchInput}
          />
          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <AppSelect
              value={department}
              onValueChange={(value) => {
                setDepartment(value);
                setPage(1);
              }}
              placeholder={selectPlaceholder('Department')}
              options={[{ value: ALL, label: 'All Departments' }, ...TICKET_DEPARTMENT_OPTIONS]}
              triggerClassName="w-[170px]"
            />
            <AppSelect
              value={priority}
              onValueChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
              placeholder={selectPlaceholder('Priority')}
              options={[{ value: ALL, label: 'All Priorities' }, ...TICKET_PRIORITY_OPTIONS]}
              triggerClassName="w-[140px]"
            />
            {hasActiveFilters && <DataTableClearFiltersButton onClick={clearFilters} />}
          </div>
        </div>

        <Card className={dataTableCardClass}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className={dataTableHeaderClass}>
                <TableRow className={dataTableHeaderRowClass}>
                  <TableHead className={cn(dataTableHeadClass, 'pl-4')}>Ticket No</TableHead>
                  <TableHead className={dataTableHeadClass}>Subject</TableHead>
                  <TableHead className={dataTableHeadClass}>Department</TableHead>
                  <TableHead className={dataTableHeadClass}>Priority</TableHead>
                  <TableHead className={dataTableHeadClass}>Status</TableHead>
                  <TableHead className={dataTableHeadClass}>
                    {isQueue ? 'Raised By / Assignee' : 'Assigned To'}
                  </TableHead>
                  <TableHead className={dataTableHeadClass}>Raised On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoadingRow colSpan={colSpan} message="Loading tickets…" />
                ) : rows.length > 0 ? (
                  rows.map((ticket) => {
                    const hint = ticket.status === 'resolved' ? autoCloseHint(ticket.auto_close_at) : null;
                    return (
                      <TableRow
                        key={ticket.id}
                        className={cn(dataTableBodyRowClass, 'cursor-pointer')}
                        onClick={() => navigate(`/helpdesk/tickets/${ticket.id}`)}
                      >
                        <TableCell className={cn(dataTableCellClass, 'pl-4 font-semibold text-primary-deep')}>
                          {ticket.ticket_no}
                        </TableCell>
                        <TableCell className={cn(dataTableCellClass, 'max-w-[320px]')}>
                          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                            {ticket.subject}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {ticket.category.name}
                            {ticket.reference_text ? ` · ${ticket.reference_text}` : ''}
                          </div>
                        </TableCell>
                        <TableCell className={dataTableCellClass}>{ticket.department_display}</TableCell>
                        <TableCell className={dataTableCellClass}>
                          <span className={ticketPriorityBadgeClass(ticket.priority)}>
                            {ticket.priority_display}
                          </span>
                        </TableCell>
                        <TableCell className={dataTableCellClass}>
                          <span className={ticketStatusBadgeClass(ticket.status)}>{ticket.status_display}</span>
                          {hint && <div className="mt-1 text-[10px] text-slate-400">{hint}</div>}
                        </TableCell>
                        <TableCell className={dataTableCellClass}>
                          {isQueue && <div>{ticket.raised_by.name}</div>}
                          <div className={isQueue ? 'text-[11px] text-slate-400' : undefined}>
                            {ticket.assigned_to?.name ?? 'Unassigned'}
                          </div>
                        </TableCell>
                        <TableCell className={dataTableCellClass}>
                          {formatAppDateTimeOrFallback(ticket.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="h-[260px] text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                          <Inbox size={24} />
                        </div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          No tickets here
                        </p>
                        {hasActiveFilters ? (
                          <DataTableClearFiltersButton onClick={clearFilters} />
                        ) : (
                          !isQueue &&
                          canRaise && (
                            <Button
                              size="sm"
                              onClick={() => setRaiseOpen(true)}
                              className={cn(dataTablePrimaryActionButtonClass, 'mt-2')}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Raise Ticket
                            </Button>
                          )
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
          currentPage={page}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={(next) => {
            setPage(next);
            window.scrollTo(0, 0);
          }}
          leftExtra={
            <DataTablePageSizeSelect
              value={pageSize}
              onChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          }
        />
      </div>

      <RaiseTicketDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        onRaised={(ticket) => navigate(`/helpdesk/tickets/${ticket.id}`)}
      />
    </div>
  );
}
