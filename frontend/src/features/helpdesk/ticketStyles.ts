import { badgeClass, type BadgeTone } from '@/lib/badgeStyles';
import type { TicketPriority, TicketStatus } from '@/lib/helpdeskApi';

const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  open: 'info',
  in_progress: 'primary',
  on_hold: 'warning',
  resolved: 'violet',
  reopened: 'danger',
  closed: 'success',
  cancelled: 'slate',
};

const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'sky',
  high: 'warning',
  critical: 'danger',
};

export function ticketStatusBadgeClass(status: TicketStatus, className?: string): string {
  return badgeClass(STATUS_TONE[status] ?? 'neutral', className);
}

export function ticketPriorityBadgeClass(priority: TicketPriority, className?: string): string {
  return badgeClass(PRIORITY_TONE[priority] ?? 'neutral', className);
}

/** "Auto-closes in 2 days" style hint for resolved tickets awaiting confirmation. */
export function autoCloseHint(autoCloseAt: string | null): string | null {
  if (!autoCloseAt) return null;
  const ms = new Date(autoCloseAt).getTime() - Date.now();
  if (ms <= 0) return 'Auto-closing shortly';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `Auto-closes in ${Math.max(hours, 1)}h`;
  const days = Math.round(hours / 24);
  return `Auto-closes in ${days} day${days === 1 ? '' : 's'}`;
}
