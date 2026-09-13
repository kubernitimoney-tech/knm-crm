import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 750;

const slides = [
  {
    id: 'personal-need',
    badge: 'For salaried professionals',
    title: 'Personal Loan for Your Personal Need — Up to ₹2 Lakh for Salaried Persons.',
    description:
      '100% digital process · Minimal documentation · Quick decision for disbursal, subject to eligibility and credit assessment',
    image: '/personal-loan/personal-loan-1.svg',
    imageAlt: 'Personal loan for salaried professionals',
  },
  {
    id: 'shopping',
    badge: 'Starting at competitive rates',
    title: 'Personal Loan for Shopping — Up to ₹2 Lakh',
    description:
      'Personal loan up to ₹2,00,000 · APR 15%–34% p.a. · No collateral · Subject to eligibility and credit assessment',
    image: '/shopping-loan/shopping-1.svg',
    imageAlt: 'Personal loan for shopping',
  },
  {
    id: 'online-process',
    badge: '100% online process',
    title: 'Personal Loan Up to ₹2 Lakh — 100% Online Process',
    description:
      'APR 15%–34% · Tenure 3–12 months · Transparent fees · Subject to eligibility',
    image: '/personal-loan/personal-loan-2.svg',
    imageAlt: '100% online personal loan process',
  },
] as const;

export function Hero() {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const goTo = useCallback(
    (target: number) => {
      setIndex(((target % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [total]);

  return (
    <section
      className="page-hero-surface"
      aria-roledescription="carousel"
      aria-label="Personal loan offers"
    >
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <div className="relative">
          {slides.map((slide, slideIndex) => {
            const isActive = slideIndex === index;
            const HeadingTag = slideIndex === 0 ? 'h1' : 'p';

            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${slideIndex + 1} of ${total}`}
                aria-hidden={!isActive}
                className={cn(
                  'w-full transition-opacity ease-in-out',
                  slideIndex === 0 ? 'relative' : 'absolute inset-0',
                  isActive
                    ? 'pointer-events-auto z-10 opacity-100'
                    : 'pointer-events-none z-0 opacity-0',
                )}
                style={{ transitionDuration: `${TRANSITION_MS}ms` }}
              >
                <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
                  <div className="max-w-xl">
                    <span className="inline-flex rounded-md border border-primary-deep/25 px-3 py-1 text-xs font-semibold text-primary-deep">
                      {slide.badge}
                    </span>

                    <HeadingTag className="mt-4 text-3xl font-bold leading-tight text-primary-deep md:text-4xl">
                      {slide.title}
                    </HeadingTag>

                    <p className="mt-4 text-sm leading-relaxed text-mid-shade md:text-base">
                      {slide.description}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        to="/contact"
                        tabIndex={isActive ? 0 : -1}
                        className="btn-secondary"
                      >
                        Contact Us
                      </Link>
                      <Link
                        to="/apply"
                        tabIndex={isActive ? 0 : -1}
                        className="btn-primary"
                      >
                        Apply Now
                      </Link>
                    </div>
                  </div>

                  <div className="flex justify-center lg:justify-end">
                    <img
                      src={slide.image}
                      alt={slide.imageAlt}
                      className="hero-float h-auto w-full max-w-[280px] bg-transparent object-contain sm:max-w-[320px] md:max-w-[360px]"
                      width={360}
                      height={360}
                      loading={slideIndex === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="relative z-20 mt-8 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Carousel slides"
        >
          {slides.map((slide, dotIndex) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Go to slide ${dotIndex + 1}`}
              onClick={() => goTo(dotIndex)}
              className={cn(
                'h-2.5 rounded-full transition-all',
                dotIndex === index
                  ? 'w-2.5 bg-primary-deep'
                  : 'w-2.5 bg-lighter-gray hover:bg-light-gray',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
