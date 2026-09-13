import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const IMAGE_INTERVAL_MS = 4000;

const FAQ_IMAGES = [
  { src: '/faq/faq-1.svg', alt: 'Frequently asked questions illustration 1' },
  { src: '/faq/faq-2.svg', alt: 'Frequently asked questions illustration 2' },
  { src: '/faq/faq-3.svg', alt: 'Frequently asked questions illustration 3' },
] as const;

interface FaqImageCarouselProps {
  className?: string;
  compact?: boolean;
  startDelayMs?: number;
}

export function FaqImageCarousel({
  className,
  compact = false,
  startDelayMs = 0,
}: FaqImageCarouselProps) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(startDelayMs === 0);

  useEffect(() => {
    if (startDelayMs === 0) return;
    const delay = window.setTimeout(() => setReady(true), startDelayMs);
    return () => window.clearTimeout(delay);
  }, [startDelayMs]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % FAQ_IMAGES.length);
    }, IMAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready]);

  return (
    <div className={cn('relative bg-transparent', className)}>
      <div
        className={cn(
          'relative mx-auto w-full bg-transparent',
          compact
            ? 'h-40 max-w-[200px] sm:h-44'
            : 'h-52 max-w-[260px] sm:h-60 sm:max-w-[280px] md:h-72 md:max-w-[360px]',
        )}
      >
        {FAQ_IMAGES.map((image, index) => {
          const isActive = index === active;
          return (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className={cn(
                'absolute inset-0 m-auto h-full w-full bg-transparent object-contain transition-all duration-700 ease-out',
                isActive ? 'service-image-zoom opacity-100' : 'scale-90 opacity-0',
              )}
              width={280}
              height={280}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          );
        })}
      </div>
    </div>
  );
}
