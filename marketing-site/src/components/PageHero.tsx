import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  image?: string;
  imageAlt?: string;
  media?: ReactNode;
  actions?: ReactNode;
  chips?: string[];
  showDefaultActions?: boolean;
}

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  media,
  actions,
  chips,
  showDefaultActions = false,
}: PageHeroProps) {
  return (
    <section className="page-hero-surface">
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:px-6 md:py-14 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-dark">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-primary-deep md:text-4xl lg:text-[2.75rem]">
            {title}
          </h1>
          <div className="mt-4 text-sm leading-relaxed text-mid-shade md:text-base">{description}</div>

          {chips && chips.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-primary-deep ring-1 ring-card-border"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          {(actions || showDefaultActions) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {actions}
              {showDefaultActions ? (
                <>
                  <Link to="/apply" className="btn-primary">
                    Apply Now
                  </Link>
                  <Link to="/contact" className="btn-secondary">
                    Contact Us
                  </Link>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="relative flex min-h-[220px] items-center justify-center lg:min-h-[320px] lg:justify-end">
          {media ??
            (image ? (
              <img
                src={image}
                alt={imageAlt ?? ''}
                className="hero-float relative z-10 h-auto w-full max-w-[280px] bg-transparent object-contain sm:max-w-[320px] md:max-w-[380px]"
                width={380}
                height={380}
                loading="eager"
                decoding="async"
              />
            ) : null)}
        </div>
      </div>
    </section>
  );
}
