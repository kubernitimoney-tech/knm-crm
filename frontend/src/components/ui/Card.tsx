import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export const Card = ({ children, title, subtitle, className, footer }: CardProps) => {
  return (
    <div className={cn("bg-white dark:bg-[#32355a] rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-black/20 flex flex-col overflow-hidden transition-all duration-300", className)}>
      {(title || subtitle) && (
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/30 dark:bg-white/[0.04]">
          <div className="flex flex-col">
            {title && <h3 className="font-black text-[13px] text-primary-deep dark:text-slate-200 uppercase tracking-widest">{title}</h3>}
            {subtitle && <p className="text-[11px] text-mid-shade dark:text-slate-400 mt-1 font-medium">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 bg-white dark:bg-transparent">
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.03] border-t border-slate-100 dark:border-white/10">
          {footer}
        </div>
      )}
    </div>
  );
};
