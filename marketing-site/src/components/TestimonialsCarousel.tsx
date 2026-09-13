import { useCallback, useEffect, useMemo, useRef, useState, type TransitionEvent } from 'react';
import { TestimonialCard } from '@/components/TestimonialCard';
import type { Testimonial } from '@/data/testimonials';

const AUTOPLAY_MS = 4500;
const TRANSITION_MS = 700;

interface TestimonialsCarouselProps {
  items: Testimonial[];
}

export function TestimonialsCarousel({ items }: TestimonialsCarouselProps) {
  const [perView, setPerView] = useState(1);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const resettingRef = useRef(false);

  useEffect(() => {
    const updatePerView = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setPerView(3);
      } else if (window.matchMedia('(min-width: 640px)').matches) {
        setPerView(2);
      } else {
        setPerView(1);
      }
    };

    updatePerView();
    window.addEventListener('resize', updatePerView);
    return () => window.removeEventListener('resize', updatePerView);
  }, []);

  const trackItems = useMemo(() => {
    if (items.length === 0) return [];
    return [...items, ...items.slice(0, perView)];
  }, [items, perView]);

  const total = items.length;
  const slidePercent = 100 / perView;

  useEffect(() => {
    resettingRef.current = true;
    setAnimate(false);
    setIndex(0);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resettingRef.current = false;
        setAnimate(true);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [perView]);

  useEffect(() => {
    if (total <= perView) return;
    const timer = window.setInterval(() => {
      if (resettingRef.current) return;
      setAnimate(true);
      setIndex((current) => current + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [total, perView]);

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      // Ignore bubbled transitions from child cards (hover/shadow).
      if (event.target !== event.currentTarget) return;
      if (index < total) return;

      resettingRef.current = true;
      setAnimate(false);
      setIndex(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          resettingRef.current = false;
          setAnimate(true);
        });
      });
    },
    [index, total],
  );

  if (items.length === 0) return null;

  return (
    <div className="mt-8 [contain:layout]">
      <div
        className="overflow-hidden [backface-visibility:hidden]"
        aria-roledescription="carousel"
        aria-label="Customer stories"
      >
        <div
          ref={trackRef}
          className="flex items-stretch will-change-transform"
          style={{
            transform: `translate3d(-${index * slidePercent}%, 0, 0)`,
            transition: animate
              ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {trackItems.map((item, itemIndex) => {
            const isClone = itemIndex >= total;
            const isVisible = itemIndex >= index && itemIndex < index + perView;

            return (
              <div
                key={isClone ? `${item.id}-clone-${itemIndex}` : item.id}
                className="box-border shrink-0 px-2 first:pl-0 last:pr-0"
                style={{ width: `${slidePercent}%` }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${(itemIndex % total) + 1} of ${total}`}
                aria-hidden={!isVisible}
              >
                <TestimonialCard
                  testimonial={item}
                  className="h-full min-h-[260px] transition-shadow duration-300 hover:translate-y-0"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
