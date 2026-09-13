import React, { useState } from 'react';
import { CircleX, Fingerprint, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { cn } from '@/lib/utils';
import { DRAWER_OVERLAY_CLASS, DRAWER_PANEL_CLASS, MODAL_HEADER_CLASS, SURFACE_CARD_CLASS } from '@/lib/uiTokens';

export interface CustomerTimelineItem {
  title: string;
  caller: string;
  datetime: string;
  body: string;
}

interface CustomerTimelineCardProps {
  items: CustomerTimelineItem[];
  emptyMessage?: string;
  /** Max entries shown in the card; remainder open in View More drawer. */
  maxVisible?: number;
  viewMoreTitle?: string;
  /** When set, shows a Log Call action in the card header (lead details). */
  onLogCall?: () => void;
  onRequestEsign?: () => void;
  onRequestVideoKyc?: () => void;
  isRequestingEsign?: boolean;
  isRequestingVideoKyc?: boolean;
}

function hasRemark(body: string): boolean {
  const trimmed = body?.trim();
  return Boolean(trimmed && trimmed !== '—');
}

const REMARK_COLLAPSE_CHAR_LIMIT = 100;

function RemarkBody({ body, compact = false }: { body: string; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong =
    body.length > REMARK_COLLAPSE_CHAR_LIMIT ||
    body.split(/\s+/).length > 14 ||
    body.includes('\n');
  const canToggle = compact && isLong;

  return (
    <div className="min-w-0">
      <div
        className={cn(
          'border border-slate-100 bg-[#f8f9fe] italic text-slate-500 dark:border-slate-800/60 dark:bg-[#17182e] dark:text-slate-450',
          'break-words [overflow-wrap:anywhere] whitespace-pre-wrap',
          compact
            ? 'mt-1 rounded-md p-1.5 text-[10px] leading-snug'
            : 'mt-0 rounded-lg p-2.5 text-[11px] leading-relaxed',
          canToggle && !expanded && 'line-clamp-3',
        )}
        title={canToggle && !expanded ? body : undefined}
      >
        {body}
      </div>
      {canToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-[9px] font-bold uppercase tracking-wide text-primary-deep hover:underline focus:outline-none dark:text-lighter-gray"
        >
          {expanded ? 'Show less' : 'Read full remark'}
        </button>
      ) : null}
    </div>
  );
}

function TimelineEntry({
  item,
  compact = false,
}: {
  item: CustomerTimelineItem;
  compact?: boolean;
}) {
  return (
    <div className="relative group min-w-0">
      <span
        className={cn(
          'absolute rounded-full border-2 border-white bg-primary-deep dark:border-slate-900',
          compact
            ? '-left-[18px] top-1.5 h-2 w-2'
            : '-left-6 top-1 h-3.5 w-3.5 border-[3px] shadow-sm shadow-primary-deep/30 transition-transform group-hover:scale-110',
        )}
      />

      <h4
        className={cn(
          'font-bold text-slate-700 dark:text-slate-250',
          compact ? 'text-[11px] leading-tight' : 'text-xs',
        )}
      >
        {item.title}
      </h4>

      <div
        className={cn(
          'font-medium text-slate-400 dark:text-slate-450',
          compact ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 mb-2 text-[10px]',
        )}
      >
        <span className="font-semibold text-slate-600 dark:text-slate-300">{item.caller}</span>
        {compact ? <span className="mx-1 text-slate-300">·</span> : <span> </span>}
        {!compact && <span>Call by: </span>}
        <span className={compact ? 'text-slate-400' : undefined}>{item.datetime}</span>
      </div>

      {hasRemark(item.body) ? <RemarkBody body={item.body} compact={compact} /> : null}
    </div>
  );
}

function TimelineList({
  items,
  compact = false,
}: {
  items: CustomerTimelineItem[];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative min-w-0 before:absolute before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-indigo-100 dark:before:bg-indigo-950',
        compact ? 'space-y-3 pl-4 before:left-[3px]' : 'space-y-6 pl-6 before:left-2',
      )}
    >
      {items.map((item, idx) => (
        <TimelineEntry key={`${item.datetime}-${item.title}-${idx}`} item={item} compact={compact} />
      ))}
    </div>
  );
}

export function CustomerTimelineCard({
  items,
  emptyMessage = 'No call activity recorded yet.',
  maxVisible = 3,
  viewMoreTitle = 'Call History',
  onLogCall,
  onRequestEsign,
  onRequestVideoKyc,
  isRequestingEsign = false,
  isRequestingVideoKyc = false,
}: CustomerTimelineCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  useEscapeKey(isDrawerOpen, () => setIsDrawerOpen(false));

  const visibleItems = items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <>
      <div
        id="timeline-card"
        className={cn('min-w-0 overflow-hidden rounded-[14px] border border-slate-150 p-4 shadow-sm shadow-slate-100/50 dark:shadow-none', SURFACE_CARD_CLASS)}
      >
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <h3 className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-200">Timeline</h3>
          <div className="flex shrink-0 items-center gap-2">
            {onRequestEsign ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-lg"
                onClick={onRequestEsign}
                disabled={isRequestingEsign}
                title="Request E-Sign"
              >
                <Fingerprint className="h-3.5 w-3.5 text-primary-deep" />
              </Button>
            ) : null}
            {onRequestVideoKyc ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-lg"
                onClick={onRequestVideoKyc}
                disabled={isRequestingVideoKyc}
                title="Request Video KYC"
              >
                <Video className="h-3.5 w-3.5 text-primary-deep" />
              </Button>
            ) : null}
            {onLogCall ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[10px] font-semibold rounded-lg"
                onClick={onLogCall}
              >
                <Phone className="mr-1 h-3 w-3" />
                Log Call
              </Button>
            ) : null}
            {hasMore ? (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-primary-deep transition-all hover:text-secondary-dark focus:outline-none dark:text-lighter-gray dark:hover:text-white"
              >
                View More
              </button>
            ) : null}
          </div>
        </div>

        {visibleItems.length > 0 ? (
          <TimelineList items={visibleItems} compact />
        ) : (
          <p className="text-[11px] italic text-slate-400">{emptyMessage}</p>
        )}
      </div>

      {isDrawerOpen ? (
        <div className={DRAWER_OVERLAY_CLASS}>
          <div className={cn(DRAWER_PANEL_CLASS, 'animate-in slide-in-from-right duration-350')}>
            <div className={MODAL_HEADER_CLASS}>
              <div className="space-y-1">
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-50">
                  {viewMoreTitle}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {items.length} call log{items.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <CircleX className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TimelineList items={items} />
            </div>

            <div className="flex justify-end border-t border-slate-150 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <Button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="h-9 rounded-lg border-none bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
