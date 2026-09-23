import { useEffect } from 'react';
import { AppRouter } from './routes';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { useUIStore } from './store/useUIStore';
import { Toaster } from '@/components/ui/toast';
import { OfflineOverlay } from '@/features/errors/OfflineOverlay';
import { clearLegacyRbacStorage } from '@/lib/legacyStorage';

import { useGlobalDialogEscape } from '@/hooks/useGlobalDialogEscape';

export default function App() {
  const { isDarkMode } = useUIStore();
  useGlobalDialogEscape();

  useEffect(() => {
    clearLegacyRbacStorage();
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const isGuestPage = path.startsWith('/sign/') || path.startsWith('/verify-kyc/');
    if (isGuestPage || !isDarkMode) {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = isGuestPage ? 'light' : '';
      return;
    }
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = '';
  }, [isDarkMode]);

  return (
    <div className="antialiased">
      <AuthBootstrap>
        <AppRouter />
      </AuthBootstrap>
      <Toaster />
      <OfflineOverlay />
    </div>
  );
}
