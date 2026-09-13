import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Smoothly scrolls back to the top of the page on every route change, unless the
 * URL has a hash (in which case we let the browser jump to that anchor) or the
 * user prefers reduced motion (then we jump instantly).
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [pathname, hash]);

  return null;
}

const SIZE = 56;
/** Outer track sits just inside the button edge. */
const TRACK_STROKE = 2.5;
/** Progress arc is thicker so it reads clearly over the track. */
const PROGRESS_STROKE = 3.5;
const PADDING = PROGRESS_STROKE / 2 + 1.5;
const RADIUS = SIZE / 2 - PADDING;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function readScrollProgress(): number {
  const scrollTop = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / maxScroll));
}

/** Floating button: circular scroll progress + smooth scroll to top. */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const next = readScrollProgress();
      setProgress(next);
      setVisible(window.scrollY > 240);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const percent = Math.round(progress * 100);

  return (
    <button
      type="button"
      aria-label={percent > 0 ? `Scroll to top, ${percent}% of page scrolled` : 'Scroll to top'}
      onClick={scrollToTop}
      className={cn(
        'group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
        'bg-white text-primary-deep shadow-[0_8px_24px_-6px_rgba(42,45,79,0.35)]',
        'ring-1 ring-primary-deep/10 transition-all duration-300',
        'hover:scale-105 hover:shadow-[0_10px_28px_-4px_rgba(42,45,79,0.4)] hover:ring-primary-deep/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-deep focus-visible:ring-offset-2',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
      >
        <defs>
          <linearGradient id="scrollProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2A2D4F" />
            <stop offset="100%" stopColor="#424665" />
          </linearGradient>
          <filter id="scrollProgressGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#2A2D4F" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Soft outer track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#2A2D4F"
          strokeOpacity={0.12}
          strokeWidth={TRACK_STROKE}
        />

        {/* Progress arc */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#scrollProgressGrad)"
          strokeWidth={PROGRESS_STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          filter="url(#scrollProgressGlow)"
          style={{
            transition: 'stroke-dashoffset 90ms linear',
          }}
        />
      </svg>

      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary-deep/5 transition-colors group-hover:bg-primary-deep/10">
        <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </span>
    </button>
  );
}
