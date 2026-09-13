import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionBinding } from '@/lib/resolvePermissionBinding';

interface PermissionGateProps {
  /** Single code or any-of list (same as manifest bindings). */
  permission: PermissionBinding;
  /** When set, every listed code must be held. */
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { canAny, canAll } = usePermissions();
  const allowed = requireAll ? canAll(permission) : canAny(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
