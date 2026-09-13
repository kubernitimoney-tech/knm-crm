import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function RequiredMark() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

const formLabelClass =
  'text-[10px] font-bold text-slate-400 uppercase tracking-wide';

const dialogLabelClass =
  'text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1';

export function FieldLabel({
  children,
  required,
  className,
  variant = 'form',
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  className?: string;
  variant?: 'form' | 'dialog';
  htmlFor?: string;
}) {
  const labelClass = variant === 'dialog' ? dialogLabelClass : formLabelClass;

  if (variant === 'dialog') {
    return (
      <Label htmlFor={htmlFor} className={cn(labelClass, className)}>
        {children}
        {required ? <RequiredMark /> : null}
      </Label>
    );
  }

  return (
    <label htmlFor={htmlFor} className={cn(labelClass, className)}>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}
