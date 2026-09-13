import { useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetUserPassword } from '@/lib/usersApi';
import { getApiErrorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { enterPlaceholder } from '@/lib/placeholders';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: ResetPasswordDialogProps) {
  const [step, setStep] = useState<'confirm' | 'success'>('confirm');
  const [customPassword, setCustomPassword] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setStep('confirm');
    setCustomPassword('');
    setTemporaryPassword('');
    setError('');
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleReset = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await resetUserPassword(userId, {
        confirm: true,
        password: customPassword.trim() || undefined,
      });
      setTemporaryPassword(result.temporary_password);
      setStep('success');
      toast({
        title: 'Password reset',
        description: `A new password was generated for ${userName}.`,
        variant: 'success',
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Could not copy password', variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary-deep">
                <Lock size={18} />
                Reset Employee Password
              </DialogTitle>
              <DialogDescription>
                Generate a new login password for <span className="font-semibold text-slate-700">{userName}</span> ({userEmail}).
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  The employee will need this password to sign in. Share it securely and ask them to change it after logging in.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Custom password (optional)
              </Label>
              <Input
                id="custom-password"
                type="password"
                value={customPassword}
                onChange={(event) => setCustomPassword(event.target.value)}
                placeholder={enterPlaceholder('new password or leave blank to auto-generate')}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-slate-400">
                Leave blank to auto-generate a secure temporary password.
              </p>
            </div>

            {error ? (
              <p className="text-sm font-medium text-rose-600">{error}</p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleReset} disabled={isSubmitting}>
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <Check size={18} />
                Password Reset Complete
              </DialogTitle>
              <DialogDescription>
                Share this password with the employee once. It will not be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <KeyRound size={14} />
                Temporary Password
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  {temporaryPassword}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword} title="Copy password">
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
