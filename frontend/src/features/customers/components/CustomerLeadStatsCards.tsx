import { Calendar, Filter, Search, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export interface CustomerLeadStats {
  applied: number;
  disbursed: number;
  rejected: number;
  others: number;
}

interface CustomerLeadStatsCardsProps {
  stats: CustomerLeadStats;
  /** Label for the fourth card (default: Others). */
  fourthCardLabel?: string;
}

export function CustomerLeadStatsCards({
  stats,
  fourthCardLabel = 'Others',
}: CustomerLeadStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border border-slate-100/60 border-l-4 border-l-primary-deep bg-white p-5 shadow-md shadow-slate-100/50 dark:border-white/10 dark:bg-[#32355a] dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep/5 text-primary-deep">
            <Search size={20} />
          </div>
          <div>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Loan Applied
            </p>
            <h3 className="mt-0.5 text-xl font-black text-primary-deep">{stats.applied}</h3>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-100/60 border-l-4 border-l-emerald-500 bg-white p-5 shadow-md shadow-slate-100/50 dark:border-white/10 dark:bg-[#32355a] dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Calendar size={20} />
          </div>
          <div>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Loan Disbursed
            </p>
            <h3 className="mt-0.5 text-xl font-black text-primary-deep">{stats.disbursed}</h3>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-100/60 border-l-4 border-l-rose-500 bg-white p-5 shadow-md shadow-slate-100/50 dark:border-white/10 dark:bg-[#32355a] dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <X size={20} />
          </div>
          <div>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Loan Rejected
            </p>
            <h3 className="mt-0.5 text-xl font-black text-primary-deep">{stats.rejected}</h3>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-100/60 border-l-4 border-l-blue-500 bg-white p-5 shadow-md shadow-slate-100/50 dark:border-white/10 dark:bg-[#32355a] dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Filter size={20} />
          </div>
          <div>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {fourthCardLabel}
            </p>
            <h3 className="mt-0.5 text-xl font-black text-primary-deep">{stats.others}</h3>
          </div>
        </div>
      </Card>
    </div>
  );
}
