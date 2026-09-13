import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

interface GuestGuardProps {
  children: React.ReactNode;
}

/** Blocks auth pages for users who already have an active session. */
export function GuestGuard({ children }: GuestGuardProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
