import {
  customerLeadStatBadgeClass,
  leadPipelineStatusTone,
} from '@/lib/badgeStyles';
import type { CustomerLeadStatCounts } from '@/lib/customerLeadStatsUtils';

interface CustomerLeadStatsBadgesProps {
  stats: CustomerLeadStatCounts;
  leadStatus?: string;
}

const COUNT_BADGE_CLASS =
  'shrink-0 flex-1 basis-[6.75rem] min-w-[6.75rem] sm:basis-[7.5rem] sm:min-w-[7.5rem] lg:min-w-0';

/** Status label can be long — do not share fixed width with numeric badges. */
const STATUS_BADGE_CLASS = 'w-auto min-w-[8rem] shrink-0 flex-none self-stretch';

const COUNT_BADGES = [
  { key: 'applied' as const, label: 'Loan Applied', tone: 'applied' as const },
  { key: 'disbursed' as const, label: 'Loan Disbursed', tone: 'disbursed' as const },
  { key: 'rejected' as const, label: 'Loan Rejected', tone: 'rejected' as const },
];

export function CustomerLeadStatsBadges({ stats, leadStatus }: CustomerLeadStatsBadgesProps) {
  return (
    <div className="w-full overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max flex-nowrap items-stretch gap-2 lg:min-w-0 lg:w-full">
        {COUNT_BADGES.map(({ key, label, tone }) => (
          <span key={key} className={customerLeadStatBadgeClass(tone, COUNT_BADGE_CLASS)}>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-75 whitespace-nowrap">
              {label}
            </span>
            <span className="text-xl font-black tabular-nums leading-none sm:text-2xl">
              {stats[key].toLocaleString()}
            </span>
          </span>
        ))}

        {leadStatus && leadStatus !== '—' ? (
          <span
            className={customerLeadStatBadgeClass(
              leadPipelineStatusTone(leadStatus),
              STATUS_BADGE_CLASS,
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-75 whitespace-nowrap">
              Status
            </span>
            <span className="text-sm font-black leading-tight whitespace-nowrap normal-case tracking-normal sm:text-base">
              {leadStatus}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
