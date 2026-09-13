import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/toast';
import { ForbiddenPage } from '@/features/errors/ForbiddenPage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { canAccessPath } = usePermissions();
  const deniedToastShown = useRef(false);

  const hasAccess = isAuthenticated && canAccessPath(location.pathname);
  const canAccessDashboard = isAuthenticated && canAccessPath('/');
  // Render a full 403 page (instead of redirecting) when the user is authenticated
  // but cannot access the current page AND has no dashboard to fall back to
  // (e.g. a user with no role assigned). This avoids an infinite redirect loop
  // that previously left the screen blank.
  const showForbiddenPage =
    isAuthenticated && !hasAccess && (location.pathname === '/' || !canAccessDashboard);

  useEffect(() => {
    if (!isAuthenticated || hasAccess) {
      deniedToastShown.current = false;
      return;
    }
    // The full 403 page already explains the denial, so only toast on a redirect.
    if (showForbiddenPage) return;
    if (!deniedToastShown.current) {
      deniedToastShown.current = true;
      toast({
        title: 'Access denied',
        description: 'You do not have permission to open this page.',
        variant: 'error',
      });
    }
  }, [isAuthenticated, hasAccess, showForbiddenPage, location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!hasAccess) {
    if (showForbiddenPage) {
      return (
        <ForbiddenPage
          showBack={false}
          showHome={false}
          showLogout
          description="Your account doesn't have access to this workspace yet. Please contact your administrator to get a role or the right permissions assigned — or sign out and try a different account."
        />
      );
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
