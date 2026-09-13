import React, { useEffect } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthBootstrapProps {
  children: React.ReactNode;
}

export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const { hydrate, hasHydrated } = useAuthStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hasHydrated) {
    return <LoadingState layout="screen" message="Loading application…" />;
  }

  return <>{children}</>;
}
