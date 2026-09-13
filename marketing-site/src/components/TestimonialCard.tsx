import { Star, Quote } from 'lucide-react';
import type { Testimonial } from '@/data/testimonials';
import { cn } from '@/lib/utils';

interface TestimonialCardProps {
  testimonial: Testimonial;
  className?: string;
  featured?: boolean;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function TestimonialCard({ testimonial, className, featured = false }: TestimonialCardProps) {
  return (
    <article
      className={cn(
        'group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl border border-card-border bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md',
        featured && 'ring-1 ring-primary-deep/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent-indigo/5 blur-xl transition-colors group-hover:bg-accent-teal/10" />

      <Quote
        className="relative mb-3 h-7 w-7 text-accent-teal/30"
        strokeWidth={1.5}
        aria-hidden="true"
      />

      <div className="relative mb-3 flex gap-0.5" aria-label={`${testimonial.rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-3.5 w-3.5',
              i < testimonial.rating ? 'fill-warning text-warning' : 'text-lighter-gray',
            )}
          />
        ))}
      </div>

      <blockquote className="relative flex-1 text-sm leading-relaxed text-mid-shade">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      <footer className="relative mt-5 flex items-center gap-3 border-t border-card-border pt-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            featured ? 'bg-accent-teal' : 'bg-accent-indigo',
          )}
          aria-hidden="true"
        >
          {initials(testimonial.name)}
        </div>
        <div>
          <p className="font-semibold text-primary-deep">{testimonial.name}</p>
          <p className="text-xs text-light-gray">{testimonial.city}</p>
        </div>
      </footer>
    </article>
  );
}
