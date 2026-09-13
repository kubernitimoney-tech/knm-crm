import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Real network connectivity for the LMS SPA.
 *
 * Problems we avoid:
 * - Flashing "No internet" on refresh / tab return when a single HEAD ping fails mid-boot
 * - Stale out-of-order ping results (slow fail after a fast success → false offline)
 * - Treating a flaky one-off request as offline
 *
 * Strategy: optimistically online; require confirmed offline (browser offline event or
 * multiple consecutive failed probes) before showing the overlay.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://localhost:8000/api/v1';
const PING_TIMEOUT_MS = 4000;
/** Failures in a row (when already online) before we flip to offline. */
const OFFLINE_FAILURE_THRESHOLD = 2;
const POLL_INTERVAL_MS = 15000;

async function probeUrl(url: string, method: 'HEAD' | 'GET', signal: AbortSignal): Promise<boolean> {
  try {
    await fetch(url, {
      method,
      cache: 'no-store',
      signal,
      // credentials omit keeps health checks free of auth side-effects
      credentials: 'omit',
    });
    // Any HTTP response means the path to a host worked (even 4xx/5xx).
    return true;
  } catch {
    return false;
  }
}

async function isReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const healthUrl = `${API_BASE}/health/?_=${Date.now()}`;
    if (await probeUrl(healthUrl, 'GET', controller.signal)) return true;

    // Fallback: same-origin shell (helps when API host differs during deploys)
    const originUrl = `${window.location.origin}/?_=${Date.now()}`;
    return probeUrl(originUrl, 'HEAD', controller.signal);
  } finally {
    window.clearTimeout(timer);
  }
}

export function useOnlineStatus() {
  // Trust the OS first; never start as offline only because of SSR.
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  const [isChecking, setIsChecking] = useState(false);

  const mountedRef = useRef(true);
  const genRef = useRef(0);
  const failCountRef = useRef(0);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const recheck = useCallback(async (): Promise<boolean> => {
    const gen = ++genRef.current;
    setIsChecking(true);
    try {
      const ok = await isReachable();
      // Ignore superseded results (focus + interval + mount racing).
      if (!mountedRef.current || gen !== genRef.current) return isOnlineRef.current;

      if (ok) {
        failCountRef.current = 0;
        setIsOnline(true);
        return true;
      }

      // Browser reports offline — trust it immediately.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        failCountRef.current = OFFLINE_FAILURE_THRESHOLD;
        setIsOnline(false);
        return false;
      }

      // Transient failure while we still think we're online: require threshold.
      failCountRef.current += 1;
      if (failCountRef.current >= OFFLINE_FAILURE_THRESHOLD || !isOnlineRef.current) {
        setIsOnline(false);
        return false;
      }
      // Keep showing online; next poll may confirm offline.
      return true;
    } finally {
      if (mountedRef.current && gen === genRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const onOffline = () => {
      failCountRef.current = OFFLINE_FAILURE_THRESHOLD;
      setIsOnline(false);
      // Immediately try to recover if it was a blip.
      window.setTimeout(() => {
        void recheck();
      }, 400);
    };

    const onOnline = () => {
      failCountRef.current = 0;
      setIsOnline(true);
      void recheck();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void recheck();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    // Soft first check — never flip offline on a single boot-time race.
    void recheck();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recheck();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      genRef.current += 1; // invalidate in-flight on unmount
      window.clearInterval(intervalId);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recheck]);

  return { isOnline, isChecking, recheck };
}
