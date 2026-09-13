import React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { getLeadCustomerTabLockedCopy } from '@/features/leads/components/leadCustomerTabLockedCopy';

interface LeadCustomerTabLockedStateProps {
  leadStatus?: string | null;
}

export function LeadCustomerTabLockedState({ leadStatus }: LeadCustomerTabLockedStateProps) {
  const copy = getLeadCustomerTabLockedCopy(leadStatus);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-8 text-center shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 sm:p-12">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-deep/5 blur-2xl dark:bg-primary-deep/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-indigo-400/10 blur-2xl" />

      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-md shadow-indigo-100/50 dark:border-indigo-900/40 dark:bg-slate-900 dark:shadow-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-deep/10 text-primary-deep dark:bg-primary-deep/20 dark:text-indigo-300">
          <FileText size={24} strokeWidth={1.75} />
        </div>
        <Sparkles size={14} className="absolute -right-1 -top-1 text-amber-500" aria-hidden="true" />
      </div>

      <h3 className="relative text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {copy.title}
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {copy.description}
      </p>

      <div className="relative mx-auto mt-6 max-w-sm rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{copy.nextStepLabel}</p>
        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{copy.nextStep}</p>
      </div>
    </div>
  );
}
