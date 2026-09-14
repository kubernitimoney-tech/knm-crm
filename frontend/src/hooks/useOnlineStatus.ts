import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Overlay follows the browser online/offline signal only.
 *
 * A timed-out Django health ping (busy worker, Digio e-sign upload, etc.)
 * must not be treated as the user being offline.
 */

function browserIsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => browserIsOnline());
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  const recheck = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const online = browserIsOnline();
      setIsOnline(online);
      return online;
    } finally {
      if (mountedRef.current) setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const onOffline = () => setIsOnline(false);
    const onOnline = () => setIsOnline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    setIsOnline(browserIsOnline());

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { isOnline, isChecking, recheck };
}
