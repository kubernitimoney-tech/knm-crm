import { Link } from 'react-router-dom';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Kept for call-site compatibility; image is used for both variants. */
  variant?: 'light' | 'dark';
}

export function Logo({ className }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn('inline-flex h-8 shrink-0 items-center', className)}
      aria-label={brand.name}
    >
      <img
        src="/logo/knm_logo.png"
        alt={brand.name}
        className="block h-8 w-auto max-h-8 object-contain object-left"
        width={140}
        height={32}
        decoding="async"
      />
    </Link>
  );
}

export function BrandTagline({ className }: { className?: string }) {
  return <p className={cn('text-sm text-light-gray', className)}>{brand.tagline}</p>;
}
