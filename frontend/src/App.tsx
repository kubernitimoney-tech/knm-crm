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
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
