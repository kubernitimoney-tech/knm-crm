import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { useTitle } from '@/hooks/useTitle';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Shown instead of the app while the signed-in user still has an admin-issued
 * temporary password. The server rejects every other API call until it is changed.
 */
export const ForcePasswordChangePage = () => {
  useTitle('Set a new password');
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-[460px] bg-white border border-slate-200 rounded-[32px] shadow-2xl">
        <div className="p-8 pb-4">
          <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep mb-4 shadow-inner">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-black text-primary-deep tracking-tight">Set a new password</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {user?.email ? <><span className="font-bold text-slate-700">{user.email}</span>, you </> : 'You '}
            signed in with a temporary password. Choose your own password to continue.
          </p>
        </div>

        <ChangePasswordForm
          currentPasswordLabel="Temporary Password"
          onSuccess={() => {
            // The store now holds the refreshed session; the guard re-renders the app.
          }}
          secondaryAction={
            <Button
              type="button"
              variant="outline"
              onClick={() => void logout()}
              className="h-12 rounded-xl text-xs font-bold text-slate-500 border-slate-200 hover:bg-slate-50 gap-2 px-5"
            >
              <LogOut size={14} />
              Sign out
            </Button>
          }
        />
      </div>
    </div>
  );
};
