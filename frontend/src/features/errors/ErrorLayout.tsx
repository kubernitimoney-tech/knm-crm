import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, LogOut, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useTitle } from '@/hooks/useTitle';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/useLogout';

export interface ErrorLayoutProps {
  code: string;
  title: string;
  description: React.ReactNode;
  icon: LucideIcon;
  /** Tailwind color accent, e.g. "rose", "amber", "sky". */
  accent?: 'rose' | 'amber' | 'sky' | 'violet';
  /** Optional extra content (e.g. technical detail, retry button). */
  children?: React.ReactNode;
  showBack?: boolean;
  /** Show the "Back to Dashboard" button. */
  showHome?: boolean;
  /** Show a "Sign out" button (useful when the user is stuck without access). */
  showLogout?: boolean;
}

const ACCENTS: Record<NonNullable<ErrorLayoutProps['accent']>, string> = {
  rose: 'text-rose-500 bg-rose-500/10 ring-rose-500/20',
  amber: 'text-amber-500 bg-amber-500/10 ring-amber-500/20',
  sky: 'text-sky-500 bg-sky-500/10 ring-sky-500/20',
  violet: 'text-violet-500 bg-violet-500/10 ring-violet-500/20',
};

export const ErrorLayout = ({
  code,
  title,
  description,
  icon: Icon,
  accent = 'rose',
  children,
  showBack = true,
  showHome = true,
  showLogout = false,
}: ErrorLayoutProps) => {
  useTitle(`${code} · ${title}`);
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-12 relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary-deep/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-secondary-dark/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center mb-8">
          <Logo to="/" />
        </div>

        <div
          className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ring-1 ${ACCENTS[accent]}`}
        >
          <Icon size={38} strokeWidth={1.75} />
        </div>

        <p className="text-[64px] leading-none font-black tracking-tighter text-slate-900 dark:text-slate-100">
          {code}
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          {description}
        </p>

        {children && <div className="mt-6">{children}</div>}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {showBack && (
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-11 px-5 rounded-xl font-semibold w-full sm:w-auto"
            >
              <ArrowLeft size={16} />
              Go Back
            </Button>
          )}
          {showHome && (
            <Button
              render={
                <Link to="/">
                  <Home size={16} />
                  Back to Dashboard
                </Link>
              }
              className="h-11 px-5 rounded-xl font-bold bg-gradient-to-r from-primary-deep to-secondary-dark text-white shadow-lg shadow-primary-deep/20 hover:scale-[1.01] active:scale-95 transition-all w-full sm:w-auto"
            />
          )}
          {showLogout && (
            <Button
              variant="destructive"
              onClick={() => void logout('manual')}
              className="h-11 px-5 rounded-xl font-bold w-full sm:w-auto"
            >
              <LogOut size={16} />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
