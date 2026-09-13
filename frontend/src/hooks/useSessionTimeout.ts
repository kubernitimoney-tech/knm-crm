import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ACTIVITY_THROTTLE_MS,
  LAST_ACTIVITY_KEY,
  SESSION_TIMEOUT_MS,
  getLastActivity,
  getRemainingSessionMs,
  isSessionExpired,
  touchSession,
} from '@/lib/session';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export function useSessionTimeout(onTimeout: () => void) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);

  onTimeoutRef.current = onTimeout;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleTimeout = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, getRemainingSessionMs());
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    touchSession();
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, SESSION_TIMEOUT_MS);
  }, [clearTimer]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) return;
    lastThrottleRef.current = now;
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimer();
      return;
    }

    if (!getLastActivity()) {
      touchSession();
    }

    if (isSessionExpired()) {
      onTimeoutRef.current();
      return;
    }

    scheduleTimeout();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY) return;
      if (isSessionExpired()) {
        onTimeoutRef.current();
      } else {
        scheduleTimeout();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated, clearTimer, handleActivity, scheduleTimeout]);
}
