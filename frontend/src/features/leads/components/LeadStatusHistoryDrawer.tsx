import React, { useCallback, useEffect, useState } from 'react';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { CircleX, Clock, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DRAWER_OVERLAY_CLASS, DRAWER_PANEL_CLASS, MODAL_HEADER_CLASS } from '@/lib/uiTokens';
import {
  fetchLeadStatusHistories,
  type ApiLeadStatusHistories,
  type ApiStatusHistoryEntry,
} from '@/lib/leadDetailsApi';

type HistoryTab = 'lead' | 'application' | 'loan';

const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'application', label: 'Application' },
  { value: 'loan', label: 'Loan' },
];

function formatChangedAt(value: string): string {
  return formatAppDateTimeOrFallback(value, value);
}

function HistoryList({ entries }: { entries: ApiStatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 italic pl-2">No status changes recorded yet.</p>;
  }

  return (
    <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800/80 space-y-6">
      {entries.map((entry) => (
        <div key={entry.id} className="relative pl-5 pb-6 last:pb-0">
          <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full bg-primary-deep ring-4 ring-primary-deep/10 dark:ring-primary-deep/20 dark:bg-primary-deep" />
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-xs font-black text-slate-850 dark:text-slate-100 leading-tight">
              {entry.from_status_display} → {entry.to_status_display}
            </h4>
            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 shrink-0 font-mono mt-0.5">
              {formatChangedAt(entry.changed_at)}
            </span>
          </div>
          <p className="text-[9px] font-extrabold text-primary-deep/70 dark:text-lighter-gray mt-1 uppercase tracking-wider leading-none">
            BY: {entry.changed_by_name}
          </p>
          {entry.remarks ? (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850">
              <p className="text-[11px] font-medium text-slate-650 dark:text-slate-350 italic">
                &ldquo;{entry.remarks}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface LeadStatusHistoryDrawerProps {
  leadId: string;
  leadName: string;
  open: boolean;
  onClose: () => void;
}

export function LeadStatusHistoryDrawer({
  leadId,
  leadName,
  open,
  onClose,
}: LeadStatusHistoryDrawerProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('lead');
  const [histories, setHistories] = useState<ApiLeadStatusHistories | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchLeadStatusHistories(leadId);
      setHistories(data);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Failed to load status history'));
      setHistories(null);
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!open) return;
    void loadHistories();
  }, [open, loadHistories]);

  if (!open) return null;

  return (
    <div className={DRAWER_OVERLAY_CLASS}>
      <div className={cn(DRAWER_PANEL_CLASS, 'animate-in slide-in-from-right duration-350')}>
        <div className={MODAL_HEADER_CLASS}>
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-primary-deep dark:text-lighter-gray" />
              Status History
            </h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Lead, application, and loan transitions for {leadName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none"
            type="button"
          >
            <CircleX className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-4 border-b border-slate-150 dark:border-white/10">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HistoryTab)}>
            <ResponsiveTabsNav
              items={HISTORY_TABS}
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as HistoryTab)}
            />
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <LoadingState message="Loading status history…" />
          ) : loadError ? (
            <div className="space-y-3">
              <p className="text-xs text-rose-600 font-medium">{loadError}</p>
              <Button size="sm" variant="outline" onClick={() => void loadHistories()}>
                Retry
              </Button>
            </div>
          ) : histories ? (
            <Tabs value={activeTab}>
              <TabsContent value="lead" className="mt-0">
                <HistoryList entries={histories.lead} />
              </TabsContent>
              <TabsContent value="application" className="mt-0">
                <HistoryList entries={histories.application} />
              </TabsContent>
              <TabsContent value="loan" className="mt-0">
                <HistoryList entries={histories.loan} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>

        <div className="p-4 border-t border-slate-150 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] flex justify-end">
          <Button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs h-9 rounded-lg px-4 border-none"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
