import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  /** When set, wraps the logo in a router link. Omit for a static logo. */
  to?: string;
  /** Public asset path. Defaults to the primary brand mark. */
  src?: string;
}

export function Logo({
  className,
  imageClassName,
  to,
  src = '/logo/logo.png',
}: LogoProps) {
  const image = (
    <img
      src={src}
      alt="Kuberniti Money"
      className={cn(
        'block h-10 w-auto max-h-10 object-contain object-left',
        imageClassName,
      )}
      width={200}
      height={48}
      decoding="async"
    />
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn('inline-flex h-auto min-h-10 shrink-0 items-center', className)}
        aria-label="Kuberniti Money"
      >
        {image}
      </Link>
    );
  }

  return (
    <div
      className={cn('inline-flex h-auto min-h-10 shrink-0 items-center', className)}
      aria-label="Kuberniti Money"
    >
      {image}
    </div>
  );
}
