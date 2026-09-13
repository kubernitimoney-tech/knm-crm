import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { clearLastActivity } from '@/lib/session';

export type LogoutReason = 'manual' | 'timeout' | 'expired' | 'replaced';

export function useLogout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isLoggingOutRef = useRef(false);

  return useCallback(
    async (reason: LogoutReason = 'manual') => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        await logout();
        clearLastActivity();

        const message =
          reason === 'timeout'
            ? 'Your session expired due to inactivity. Please sign in again.'
            : reason === 'replaced'
              ? 'Your account was signed in on another device. Please sign in again.'
            : reason === 'expired'
              ? 'Your session has expired. Please sign in again.'
              : undefined;

        navigate('/login', {
          replace: true,
          state: message ? { message } : undefined,
        });
      } finally {
        isLoggingOutRef.current = false;
      }
    },
    [logout, navigate],
  );
}
