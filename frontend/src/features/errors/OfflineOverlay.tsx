import { useState } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Full-screen overlay only after connectivity is confirmed offline.
 * Avoids flash on refresh/tab focus when a single bootstrap ping fails.
 */
export const OfflineOverlay = () => {
  const { isOnline, isChecking, recheck } = useOnlineStatus();
  const [retrying, setRetrying] = useState(false);

  // Stay out of the way while online, including during soft rechecks.
  if (isOnline) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await recheck();
    } finally {
      setRetrying(false);
    }
  };

  const busy = retrying || isChecking;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm px-6 py-12"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary-deep/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-secondary-dark/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-center mb-8">
          <Logo />
        </div>

        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ring-1 text-rose-500 bg-rose-500/10 ring-rose-500/20">
          <WifiOff size={38} strokeWidth={1.75} />
        </div>

        <h1
          id="offline-title"
          className="text-xl font-bold text-slate-900 dark:text-slate-100"
        >
          No internet connection
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          You appear to be offline. Please check your Wi-Fi or mobile data and try again — your
          work stays on this page and will resume once you reconnect.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <Button
            onClick={handleRetry}
            disabled={busy}
            className="h-11 px-5 rounded-xl font-bold bg-gradient-to-r from-primary-deep to-secondary-dark text-white shadow-lg shadow-primary-deep/20 hover:scale-[1.01] active:scale-95 transition-all"
          >
            <RotateCw size={16} className={busy ? 'animate-spin' : undefined} />
            {busy ? 'Checking…' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  );
};
