import { Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingStateSize = 'default' | 'compact' | 'sm';

/** inline = default; section = tab/panel; page = route; screen = full viewport */
type LoadingStateLayout = 'inline' | 'section' | 'page' | 'screen';

const iconSizes: Record<LoadingStateSize, number> = {
  default: 24,
  compact: 22,
  sm: 20,
};

const layoutClass: Record<LoadingStateLayout, string> = {
  inline: '',
  section: 'min-h-[200px] w-full',
  page: 'min-h-[60vh] w-full',
  screen: 'min-h-screen w-full bg-slate-50',
};

export function LoadingState({
  message = 'Loading data…',
  size = 'default',
  layout = 'inline',
  className,
}: {
  message?: string;
  size?: LoadingStateSize;
  layout?: LoadingStateLayout;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        layoutClass[layout],
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader
        size={iconSizes[size]}
        strokeWidth={2}
        className="animate-spin text-primary-deep"
        aria-hidden
      />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
}
