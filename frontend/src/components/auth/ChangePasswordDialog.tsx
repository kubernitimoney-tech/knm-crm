import React, { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from '@/components/ui/field-label';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { enterPlaceholder } from '@/lib/placeholders';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog = ({ isOpen, onOpenChange }: ChangePasswordDialogProps) => {
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStatus('success');
      setTimeout(() => {
        onOpenChange(false);
        setStatus('idle');
      }, 2000);
    }, 1500);
  };

  const toggleVisibility = (key: keyof typeof showPassword) => {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const dismissDialog = () => {
    setShowPassword({ current: false, new: false, confirm: false });
    setIsLoading(false);
    setStatus('idle');
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open, eventDetails) => {
        handleDialogOpenChange(open, eventDetails, {
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[440px] bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-8 pb-4">
          <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep mb-4 shadow-inner">
            <ShieldCheck size={24} />
          </div>
          <DialogTitle className="text-2xl font-black text-primary-deep tracking-tight">Security Update</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Update your account password to maintain security standards.
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="p-12 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold text-emerald-600">Password Updated!</h3>
            <p className="text-slate-500 text-sm font-medium">Your credentials have been updated successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-8 space-y-5">
              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Current Password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    type={showPassword.current ? 'text' : 'password'}
                    placeholder={enterPlaceholder('Password')}
                    required
                    className="h-12 pl-12 pr-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary-deep/10 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('current')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep transition-colors"
                  >
                    {showPassword.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>New Password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    type={showPassword.new ? 'text' : 'password'}
                    placeholder={enterPlaceholder('New Password')}
                    required
                    className="h-12 pl-12 pr-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary-deep/10 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('new')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep transition-colors"
                  >
                    {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Confirm New Password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    type={showPassword.confirm ? 'text' : 'password'}
                    placeholder={enterPlaceholder('Confirm New Password')}
                    required
                    className="h-12 pl-12 pr-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary-deep/10 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('confirm')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep transition-colors"
                  >
                    {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <AlertCircle className="text-amber-500 shrink-0" size={14} />
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Changing your password will require a re-login on all other active devices for security purposes.
                </p>
              </div>
            </div>

            <DialogFooter className="p-8 flex flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                data-dialog-dismiss="true"
                onClick={closeDialog}
                className="flex-1 h-12 rounded-xl text-xs font-bold text-slate-500 border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-12 bg-gradient-to-r from-primary-deep to-secondary-dark text-white rounded-xl font-bold shadow-xl shadow-primary-deep/20 hover:opacity-90 active:scale-[0.98] transition-all text-xs"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
