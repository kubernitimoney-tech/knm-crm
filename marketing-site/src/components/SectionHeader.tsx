import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderAlign = 'left' | 'center';
type SectionHeaderAccent = 'teal' | 'indigo';
type SectionHeaderAs = 'h1' | 'h2';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  align?: SectionHeaderAlign;
  accent?: SectionHeaderAccent;
  as?: SectionHeaderAs;
  action?: ReactNode;
  className?: string;
}

const accentClass: Record<SectionHeaderAccent, string> = {
  teal: 'text-secondary-dark',
  indigo: 'text-primary-deep',
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  accent = 'teal',
  as = 'h2',
  action,
  className,
}: SectionHeaderProps) {
  const Heading = as;

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className={cn(align === 'center' && 'mx-auto')}>
        <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', accentClass[accent])}>
          {eyebrow}
        </p>
        <Heading className="mt-1 text-2xl font-bold text-primary-deep md:text-3xl">{title}</Heading>
        {description ? (
          <div
            className={cn(
              'mt-2 text-sm text-mid-shade md:text-base',
              align === 'center' ? 'mx-auto max-w-xl' : 'max-w-lg',
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
      {action && align === 'left' ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
