import { cn } from '@/lib/utils';
import { CIBIL_SCORE_MAX, CIBIL_SCORE_MIN } from '@/lib/indiaValidators';

export const BADGE_BASE_CLASS =
  'inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide leading-tight whitespace-nowrap shadow-none';

export type BadgeTone =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'primary'
  | 'neutral'
  | 'violet'
  | 'sky'
  | 'slate';

/** Chip badges: pale fill + soft tinted border + medium-weight label (see status chips on leads table). */
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  success:
    'bg-emerald-50/80 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/35',
  danger:
    'bg-rose-50/80 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/35',
  warning:
    'bg-amber-50/80 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/35',
  info:
    'bg-sky-50/80 text-sky-600 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/35',
  primary:
    'bg-indigo-50/80 text-indigo-600 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:border-indigo-400/35',
  neutral:
    'bg-slate-50/80 text-slate-500 border-slate-200 dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-400/35',
  violet:
    'bg-violet-50/80 text-violet-600 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/35',
  sky:
    'bg-cyan-50/80 text-cyan-600 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-400/35',
  slate:
    'bg-slate-100/80 text-slate-500 border-slate-200 dark:bg-slate-600/20 dark:text-slate-200 dark:border-slate-400/35',
};

export function badgeClass(tone: BadgeTone, className?: string): string {
  return cn(BADGE_BASE_CLASS, BADGE_TONE_CLASS[tone], className);
}

const STAT_SUMMARY_TONE_CLASS = {
  total:
    'bg-blue-50/80 text-blue-600 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-400/35',
  fresh:
    'bg-emerald-50/80 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/35',
  reloan:
    'bg-indigo-50/80 text-indigo-600 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:border-indigo-400/35',
} as const;

/** Very light summary chips for page-level counts (e.g. Total: 120). */
export function statSummaryBadgeClass(
  tone: keyof typeof STAT_SUMMARY_TONE_CLASS,
  className?: string,
): string {
  return cn(
    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium normal-case tracking-normal shadow-none',
    STAT_SUMMARY_TONE_CLASS[tone],
    className,
  );
}

const CUSTOMER_LEAD_STAT_TONE_CLASS = {
  applied: BADGE_TONE_CLASS.primary,
  disbursed: BADGE_TONE_CLASS.success,
  rejected: BADGE_TONE_CLASS.danger,
  inProcess: BADGE_TONE_CLASS.warning,
  others: BADGE_TONE_CLASS.violet,
  status: BADGE_TONE_CLASS.neutral,
} as const;

/** Large stat chips on lead / customer detail pages (Loan Applied, In Process, etc.). */
export function customerLeadStatBadgeClass(
  tone: keyof typeof CUSTOMER_LEAD_STAT_TONE_CLASS | BadgeTone,
  className?: string,
): string {
  const toneClass =
    tone in CUSTOMER_LEAD_STAT_TONE_CLASS
      ? CUSTOMER_LEAD_STAT_TONE_CLASS[tone as keyof typeof CUSTOMER_LEAD_STAT_TONE_CLASS]
      : BADGE_TONE_CLASS[tone as BadgeTone];
  return cn(
    'inline-flex min-w-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 shadow-none sm:px-4 sm:py-3',
    toneClass,
    className,
  );
}

export function leadStatusBadgeClass(status: string, className?: string): string {
  const normalized = status.toLowerCase().trim();
  if (!normalized || normalized === '—' || normalized === 'no active lead') {
    return badgeClass('neutral', className);
  }
  if (normalized === 'fresh') return badgeClass('success', className);
  if (normalized === 'reloan') return badgeClass('primary', className);
  if (normalized.includes('reject') || normalized.includes('red flag')) {
    return badgeClass('danger', className);
  }
  if (normalized.includes('closed')) return badgeClass('slate', className);
  if (normalized.includes('settled') || normalized.includes('settlement')) {
    return badgeClass('violet', className);
  }
  if (normalized.includes('part payment')) return badgeClass('sky', className);
  if (normalized.includes('pending') || normalized.includes('waiting')) {
    return badgeClass('warning', className);
  }
  if (normalized === 'new') return badgeClass('success', className);
  if (
    normalized.includes('approv') ||
    normalized.includes('disburs') ||
    (normalized.includes('sanction') && !normalized.includes('pending')) ||
    (normalized.includes('verified') && !normalized.includes('pending'))
  ) {
    return badgeClass('success', className);
  }
  return badgeClass('neutral', className);
}

const PIPELINE_STATUS_TONE: Record<string, BadgeTone> = {
  'pending contact': 'warning',
  fresh: 'success',
  reloan: 'primary',
  busy: 'warning',
  'call back': 'warning',
  'call disconnected': 'slate',
  'no answer': 'slate',
  'switched off': 'slate',
  contacted: 'sky',
  'follow up': 'warning',
  interested: 'primary',
  'documents received': 'sky',
  'not interested': 'danger',
  'duplicate lead': 'danger',
  'invalid number': 'danger',
  'loan running': 'primary',
  closed: 'slate',
  'documents incomplete': 'warning',
  'documents verified': 'sky',
  'documents unverified': 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'slate',
  'disbursal sheet sent': 'violet',
  disbursed: 'success',
  active: 'success',
  overdue: 'warning',
  defaulted: 'danger',
  assigned: 'primary',
  'sanction pending': 'warning',
  'sanction approved': 'success',
  'sanction rejected': 'danger',
  'field investigation pending': 'warning',
  'rejected after approval': 'danger',
  'part payment': 'sky',
  'payday pre-close': 'violet',
  settlement: 'violet',
  settled: 'violet',
  'red flag': 'danger',
};

/** Strip trailing close-reason suffix e.g. "Closed (DND)" → "closed". */
function normalizePipelineStatusLabel(status: string): string {
  return status
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .toLowerCase()
    .trim();
}

/** Resolve badge tone for a pipeline status display label. */
export function leadPipelineStatusTone(status: string): BadgeTone {
  const normalized = normalizePipelineStatusLabel(status);
  if (!normalized || normalized === '—' || normalized === 'no active lead') {
    return 'neutral';
  }
  const mapped = PIPELINE_STATUS_TONE[normalized];
  if (mapped) return mapped;
  if (normalized.includes('pending') || normalized.includes('waiting')) {
    return 'warning';
  }
  if (normalized === 'fresh' || normalized === 'new') return 'success';
  if (normalized === 'reloan') return 'primary';
  if (normalized.includes('reject') || normalized.includes('red flag')) return 'danger';
  if (normalized.includes('closed') || normalized.includes('cancel')) return 'slate';
  if (normalized.includes('settled') || normalized.includes('settlement')) return 'violet';
  if (normalized.includes('part payment')) return 'sky';
  if (
    normalized.includes('approv') ||
    normalized.includes('disburs') ||
    (normalized.includes('sanction') && !normalized.includes('pending')) ||
    (normalized.includes('verified') && !normalized.includes('pending'))
  ) {
    return 'success';
  }
  if (normalized.includes('document')) return 'sky';
  if (normalized.includes('interest')) return 'primary';
  return 'neutral';
}

/** Distinct badge color per lead pipeline status label. */
export function leadPipelineStatusBadgeClass(status: string, className?: string): string {
  return badgeClass(leadPipelineStatusTone(status), className);
}

export function userStatusBadgeClass(status: string, className?: string): string {
  switch (status) {
    case 'Active':
      return badgeClass('success', className);
    case 'Inactive':
      return badgeClass('neutral', className);
    case 'Resigned':
      return badgeClass('warning', className);
    case 'Absconding':
      return badgeClass('danger', className);
    default:
      return badgeClass('neutral', className);
  }
}

export function verifiedEntryBadgeClass(verified: boolean, className?: string): string {
  return entryStatusBadgeClass(verified ? 'verified' : 'unverified', className);
}

export function entryStatusBadgeClass(
  status: 'verified' | 'unverified' | 'incomplete',
  className?: string,
): string {
  switch (status) {
    case 'verified':
      return badgeClass('success', className);
    case 'incomplete':
      return badgeClass('danger', className);
    default:
      return badgeClass('warning', className);
  }
}

export function esignStatusBadgeClass(status: string, className?: string): string {
  if (status === 'signed' || status === 'completed') {
    return badgeClass('success', className);
  }
  return badgeClass('warning', className);
}

export function esignRequestStatusDisplay(status: string): { label: string; className: string } {
  if (status === 'signed' || status === 'completed') {
    return { label: 'Signed', className: esignStatusBadgeClass(status) };
  }
  return { label: 'Requested', className: esignStatusBadgeClass(status) };
}

export function enachStatusBadgeClass(status: string, className?: string): string {
  switch (status) {
    case 'Registered':
      return badgeClass('success', className);
    case 'Pending':
      return badgeClass('warning', className);
    case 'Failed':
      return badgeClass('danger', className);
    default:
      return badgeClass('neutral', className);
  }
}

export function collectionStatusBadgeClass(status: string, className?: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('received') || normalized.includes('close') || normalized.includes('paid')) {
    return badgeClass('success', className);
  }
  if (normalized.includes('fail')) return badgeClass('danger', className);
  if (normalized.includes('part')) return badgeClass('sky', className);
  if (normalized.includes('settle')) return badgeClass('violet', className);
  if (normalized.includes('pending')) return badgeClass('warning', className);
  return badgeClass('neutral', className);
}

export function remarkPriorityBadgeClass(priority: string, className?: string): string {
  const normalized = priority.toLowerCase().trim();
  if (normalized === 'high') return badgeClass('danger', className);
  if (normalized === 'medium') return badgeClass('warning', className);
  if (normalized === 'low') return badgeClass('info', className);
  return badgeClass('neutral', className);
}

/** CIBIL consumer score bands (300–900): poor → excellent. */
const CIBIL_BAND_CLASS = {
  poor:
    'bg-rose-50/80 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/35',
  fair:
    'bg-orange-50/80 text-orange-600 border-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-400/35',
  average:
    'bg-amber-50/80 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/35',
  good:
    'bg-lime-50/80 text-lime-700 border-lime-300 dark:bg-lime-500/15 dark:text-lime-200 dark:border-lime-400/35',
  excellent:
    'bg-emerald-50/80 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/35',
} as const;

function parseCibilScore(score: number | string | null | undefined): number | null {
  if (score == null || score === '') return null;
  const numeric = typeof score === 'string' ? Number.parseInt(score, 10) : score;
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

/** Badge class for Indian CIBIL scores: 300–600 red, 601–700 orange, 701–760 yellow, 761–800 lime, 801–900 green. */
export function cibilScoreBadgeClass(
  score: number | string | null | undefined,
  className?: string,
): string {
  const numeric = parseCibilScore(score);
  const base = cn(
    BADGE_BASE_CLASS,
    'min-w-[45px] inline-block text-center normal-case tracking-normal font-black',
    className,
  );

  if (numeric == null || numeric < CIBIL_SCORE_MIN || numeric > CIBIL_SCORE_MAX) {
    return cn(base, BADGE_TONE_CLASS.neutral);
  }
  if (numeric <= 600) return cn(base, CIBIL_BAND_CLASS.poor);
  if (numeric <= 700) return cn(base, CIBIL_BAND_CLASS.fair);
  if (numeric <= 760) return cn(base, CIBIL_BAND_CLASS.average);
  if (numeric <= 800) return cn(base, CIBIL_BAND_CLASS.good);
  return cn(base, CIBIL_BAND_CLASS.excellent);
}
