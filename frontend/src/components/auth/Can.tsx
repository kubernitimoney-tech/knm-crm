import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

type CanAction = 'edit' | 'delete' | 'grant';

interface CanProps {
  action: CanAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ action, children, fallback = null }) => {
  const { canEdit, canDelete, canGrantPermission } = usePermissions();

  const allowed =
    action === 'edit' ? canEdit : action === 'delete' ? canDelete : canGrantPermission;

  return allowed ? <>{children}</> : <>{fallback}</>;
};
