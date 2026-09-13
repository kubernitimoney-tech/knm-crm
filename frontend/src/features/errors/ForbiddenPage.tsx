import type React from 'react';
import { ShieldAlert } from 'lucide-react';
import { ErrorLayout } from './ErrorLayout';

interface ForbiddenPageProps {
  title?: string;
  description?: React.ReactNode;
  showBack?: boolean;
  showHome?: boolean;
  showLogout?: boolean;
}

export const ForbiddenPage = ({
  title = 'Access denied',
  description = "You don't have permission to view this page. If you believe this is a mistake, contact your administrator to review your access rights.",
  showBack,
  showHome,
  showLogout,
}: ForbiddenPageProps) => {
  return (
    <ErrorLayout
      code="403"
      title={title}
      icon={ShieldAlert}
      accent="amber"
      description={description}
      showBack={showBack}
      showHome={showHome}
      showLogout={showLogout}
    />
  );
};
