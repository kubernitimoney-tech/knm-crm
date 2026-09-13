import { useCallback, useEffect } from 'react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useLogout, type LogoutReason } from '@/hooks/useLogout';

export function SessionManager() {
  const logout = useLogout();

  const handleTimeout = useCallback(() => {
    void logout('timeout');
  }, [logout]);

  useSessionTimeout(handleTimeout);

  useEffect(() => {
    const handleForcedLogout = (event: Event) => {
      const reason =
        (event as CustomEvent<{ reason?: LogoutReason }>).detail?.reason ?? 'expired';
      void logout(reason);
    };

    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, [logout]);

  return null;
}
