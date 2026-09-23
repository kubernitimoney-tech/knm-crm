import { Badge } from '@/components/ui/badge';
import { leadStatusBadgeClass } from '@/lib/badgeStyles';
import { cn } from '@/lib/utils';

interface LeadCategoryBadgeProps {
  category: string;
  customerLeadCount?: number;
  className?: string;
}

/** Fresh / Reloan chip; reloan shows total customer lead count as a nested badge. */
export function LeadCategoryBadge({
  category,
  customerLeadCount,
  className,
}: LeadCategoryBadgeProps) {
  const normalized = category.toLowerCase().trim();
  if (!normalized || normalized === '—') {
    return <span className="text-slate-400">—</span>;
  }

  const isReloan = normalized === 'reloan';
  const label = isReloan ? 'Reloan' : normalized === 'fresh' ? 'Fresh' : category;

  if (isReloan && customerLeadCount != null && customerLeadCount > 0) {
    return (
      <Badge className={cn(leadStatusBadgeClass('Reloan'), 'gap-1', className)}>
        Reloan
        <span
          className={cn(
            leadStatusBadgeClass('Reloan'),
            'px-1.5 py-0 text-[9px] leading-none border-indigo-300 bg-white/90 dark:bg-indigo-950/40',
          )}
        >
          {customerLeadCount}
        </span>
      </Badge>
    );
  }

  return <Badge className={cn(leadStatusBadgeClass(label), className)}>{label}</Badge>;
}
