import { Sparkles, Users } from 'lucide-react';

export function CustomerRelatedLeadsEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-deep/5 blur-2xl dark:bg-primary-deep/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />

      <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-md shadow-indigo-100/50 dark:border-indigo-900/40 dark:bg-slate-900 dark:shadow-none">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep/10 text-primary-deep dark:bg-primary-deep/20 dark:text-indigo-300">
          <Users size={22} strokeWidth={1.75} />
        </div>
        <Sparkles size={12} className="absolute -right-1 -top-1 text-amber-500" aria-hidden="true" />
      </div>

      <h3 className="relative text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
        No previous leads to show
      </h3>
      <p className="relative mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        This customer has no previous loan applications. If they apply again, those leads will appear here.
      </p>
    </div>
  );
}
