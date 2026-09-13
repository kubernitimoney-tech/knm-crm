import { useEffect, useState } from 'react';

/**
 * Detects whether a fixed element anchored to the bottom-right corner currently
 * sits over a dark section (marked with `data-surface="dark"`), so floating
 * buttons can flip to a contrasting style for visibility.
 *
 * @param bottomOffsetPx Vertical distance (px) from the viewport bottom to the
 *   element's center — used as the probe point.
 */
export function useOverDarkSurface(bottomOffsetPx: number): boolean {
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const check = () => {
      // Probe near the right edge, aligned with the button's vertical center.
      const x = window.innerWidth - 48;
      const y = window.innerHeight - bottomOffsetPx;

      let over = false;
      document.querySelectorAll('[data-surface="dark"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          over = true;
        }
      });
      setIsOver(over);
    };

    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [bottomOffsetPx]);

  return isOver;
}
