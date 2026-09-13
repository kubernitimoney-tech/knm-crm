import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { format, subDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ExportButton } from '@/components/ui/ExportButton';
import { Tabs } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
import { LeadsDataTable } from '@/components/leads/LeadsDataTable';
import { TransferLeadDialog } from '@/components/leads/TransferLeadDialog';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/components/ui/toast';
import { useTitle } from '@/hooks/useTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import {
  deleteLead,
  fetchAllLeads,
  fetchLeadListSummary,
  fetchLeads,
  formatLeadListExportRow,
  LEAD_LIST_EXPORT_HEADERS,
  leadSortToOrdering,
  mapApiLeadToRow,
} from '@/lib/leadsApi';
import { buildExportFilename, exportToExcel, periodFilterSlug } from '@/lib/utils';
import type { Lead } from '@/types';
import {
  isStatusWiseLeadTab,
  STATUS_WISE_LEAD_TABS,
  statusWiseTabEmptyMessage,
  statusWiseTabFetchParams,
  type StatusWiseLeadTab,
} from '@/features/leads/statusWiseLeadTabs';

/** Status-wise lead listing — one tab maps to server filters; table uses serverSide pagination. */
export function StatusWiseLeadsPage() {
  useTitle('Status Wise Leads');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: StatusWiseLeadTab = isStatusWiseLeadTab(tabParam) ? tabParam : 'fresh';

  const { hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canTransfer = hasPermission('lead.assign') && (isSuperAdmin || isAdmin);
  const canEdit = hasPermission('lead.update');
  const canDelete = hasPermission('lead.delete');
  const { isAuthenticated } = useAuthStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, fresh: 0, reloan: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [transferLead, setTransferLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'createdAt',
    direction: 'desc',
  });

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const listQueryParams = useMemo(() => {
    let date_from: string | undefined;
    let date_to: string | undefined;
    const today = new Date();
    if (dateFilter === 'Today') {
      date_from = format(startOfDay(today), 'yyyy-MM-dd');
      date_to = format(endOfDay(today), 'yyyy-MM-dd');
    } else if (dateFilter === 'Last 7 Days') {
      date_from = format(subDays(today, 7), 'yyyy-MM-dd');
      date_to = format(today, 'yyyy-MM-dd');
    } else if (dateFilter === 'Current Month') {
      date_from = format(startOfMonth(today), 'yyyy-MM-dd');
      date_to = format(today, 'yyyy-MM-dd');
    } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
      date_from = format(startOfDay(dateRange.from), 'yyyy-MM-dd');
      date_to = format(endOfDay(dateRange.to), 'yyyy-MM-dd');
    }

    const tabParams = statusWiseTabFetchParams(activeTab);

    return {
      ...tabParams,
      search: debouncedSearch || undefined,
      date_from,
      date_to,
      ordering: leadSortToOrdering(sortConfig.key, sortConfig.direction),
    };
  }, [activeTab, debouncedSearch, dateFilter, dateRange, sortConfig]);

  const loadLeads = useCallback(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setLoadError('');
    Promise.all([
      fetchLeads({ ...listQueryParams, page: currentPage, page_size: itemsPerPage }),
      fetchLeadListSummary(listQueryParams),
    ])
      .then(([page, counts]) => {
        setLeads(
          page.results.map((lead) =>
            mapApiLeadToRow(lead, { preferLeadStatus: activeTab !== 'rejected' }),
          ),
        );
        setTotalCount(page.count);
        setSummary({ total: counts.total, fresh: counts.fresh, reloan: counts.reloan });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load leads';
        setLoadError(message);
        const status = err instanceof AxiosError ? err.response?.status : undefined;
        if (status === 401) {
          toast({
            title: 'Session expired',
            description: 'Please sign in again to view leads.',
            variant: 'error',
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, listQueryParams, currentPage, itemsPerPage, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch, categoryFilter, dateFilter, dateRange.from, dateRange.to, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLead(deleteTarget.id);
      toast({
        title: 'Lead deleted',
        description: `${deleteTarget.leadId} removed.`,
        variant: 'success',
      });
      setDeleteTarget(null);
      loadLeads();
    } catch (err) {
      toast({
        title: 'Failed to delete lead',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All');
    setDateFilter('All Time');
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = (await fetchAllLeads(listQueryParams)).map((lead) =>
        mapApiLeadToRow(lead, { preferLeadStatus: activeTab !== 'rejected' }),
      );
      if (!rows.length) {
        toast({
          title: 'Nothing to export',
          description: 'No leads match the current filters.',
          variant: 'error',
        });
        return;
      }

      const exportRows = rows.map((lead, index) => formatLeadListExportRow(lead, index));
      const tabLabel = STATUS_WISE_LEAD_TABS.find((t) => t.value === activeTab)?.label ?? activeTab;
      exportToExcel(
        exportRows,
        LEAD_LIST_EXPORT_HEADERS.map((label) => ({
          label,
          key: label as keyof (typeof exportRows)[number],
        })),
        buildExportFilename(`leads_${activeTab}`, periodFilterSlug(dateFilter)),
        tabLabel,
        {
          module: 'lead',
          screen: `status-wise-${activeTab}`,
          label: `Status wise leads (${tabLabel})`,
        },
      );
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-bold text-slate-950 tracking-tight">Status Wise Leads</h1>
          <p className="text-xs font-medium text-slate-500">
            Browse leads by pipeline status and call disposition
          </p>
        </div>
        <ExportButton
          permission="lead.export"
          onClick={handleExport}
          disabled={isLoading || isExporting}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ResponsiveTabsNav
          items={STATUS_WISE_LEAD_TABS}
          value={activeTab}
          onValueChange={setActiveTab}
        />

        <LeadsDataTable
          key={activeTab}
          listReturnTo={{ type: 'status-wise', tab: activeTab }}
          leads={leads}
          isLoading={isLoading}
          loadError={loadError}
          onRetry={loadLeads}
          hideCategoryFilters
          hidePipelineStatusFilter
          emptyMessage={statusWiseTabEmptyMessage(activeTab)}
          onTransfer={canTransfer ? setTransferLead : undefined}
          onEdit={canEdit ? setEditLead : undefined}
          onDelete={canDelete ? setDeleteTarget : undefined}
          serverSide
          totalCount={totalCount}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo(0, 0);
          }}
          onPageSizeChange={(size) => {
            setItemsPerPage(size);
            setCurrentPage(1);
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          sortConfig={sortConfig}
          onSortChange={handleSort}
          categoryCounts={{
            all: summary.total,
            fresh: summary.fresh,
            reloan: summary.reloan,
          }}
          onClearFilters={handleClearFilters}
        />
      </Tabs>

      <TransferLeadDialog
        isOpen={transferLead !== null}
        onOpenChange={(open) => {
          if (!open) setTransferLead(null);
        }}
        lead={transferLead}
        onTransferred={loadLeads}
      />
      <EditLeadDialog
        isOpen={editLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditLead(null);
        }}
        lead={editLead}
        onUpdated={loadLeads}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this lead?"
        description={
          deleteTarget
            ? `${deleteTarget.leadId} • ${deleteTarget.customerName} will be permanently removed.`
            : undefined
        }
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
