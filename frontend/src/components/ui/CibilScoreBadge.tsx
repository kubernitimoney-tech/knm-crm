import { cibilScoreBadgeClass } from '@/lib/badgeStyles';

interface CibilScoreBadgeProps {
  score: number | string | null | undefined;
  className?: string;
}

export function CibilScoreBadge({ score, className }: CibilScoreBadgeProps) {
  const display =
    score == null || score === ''
      ? '—'
      : typeof score === 'number' && score === 0
        ? '—'
        : String(score);

  return <span className={cibilScoreBadgeClass(score, className)}>{display}</span>;
}
