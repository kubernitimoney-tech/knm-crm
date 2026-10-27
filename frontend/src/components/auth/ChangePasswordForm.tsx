import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import { enterPlaceholder } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api';
import { PASSWORD_RULES, validatePasswordPolicy } from '@/lib/passwordPolicy';
import { useAuthStore } from '@/store/useAuthStore';

type FieldKey = 'current' | 'new' | 'confirm';

const FIELDS: { key: FieldKey; label: string; placeholder: string; autoComplete: string }[] = [
  { key: 'current', label: 'Current Password', placeholder: 'Password', autoComplete: 'current-password' },
  { key: 'new', label: 'New Password', placeholder: 'New Password', autoComplete: 'new-password' },
  { key: 'confirm', label: 'Confirm New Password', placeholder: 'Confirm New Password', autoComplete: 'new-password' },
];

interface ChangePasswordFormProps {
  onSuccess: () => void;
  /** Rendered next to the submit button (e.g. Cancel or Sign out). */
  secondaryAction?: React.ReactNode;
  currentPasswordLabel?: string;
}

export const ChangePasswordForm = ({
  onSuccess,
  secondaryAction,
  currentPasswordLabel,
}: ChangePasswordFormProps) => {
  const changePassword = useAuthStore((state) => state.changePassword);
  const [values, setValues] = useState<Record<FieldKey, string>>({ current: '', new: '', confirm: '' });
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({ current: false, new: false, confirm: false });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const policyError = validatePasswordPolicy(values.new);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (values.new !== values.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (values.new === values.current) {
      setError('New password must be different from the current one.');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(values.current, values.new);
      setValues({ current: '', new: '', confirm: '' });
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-8 space-y-5">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
            {error}
          </div>
        )}

        {FIELDS.map(({ key, label, placeholder, autoComplete }) => (
          <div key={key} className="space-y-2">
            <FieldLabel variant="dialog" required>
              {key === 'current' && currentPasswordLabel ? currentPasswordLabel : label}
            </FieldLabel>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                type={visible[key] ? 'text' : 'password'}
                placeholder={enterPlaceholder(placeholder)}
                autoComplete={autoComplete}
                required
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="h-12 pl-12 pr-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary-deep/10 text-sm font-medium"
              />
              <button
                type="button"
                aria-label={visible[key] ? `Hide ${label}` : `Show ${label}`}
                onClick={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep transition-colors"
              >
                {visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ))}

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(values.new);
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-1.5 text-[10px] font-semibold',
                  met ? 'text-emerald-600' : 'text-slate-400',
                )}
              >
                {met ? <Check size={12} /> : <X size={12} />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <AlertCircle className="text-amber-500 shrink-0" size={14} />
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
            Changing your password signs you out on all other devices.
          </p>
        </div>
      </div>

      <div className="p-8 flex flex-row gap-3">
        {secondaryAction}
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 h-12 bg-gradient-to-r from-primary-deep to-secondary-dark text-white rounded-xl font-bold shadow-xl shadow-primary-deep/20 hover:opacity-90 active:scale-[0.98] transition-all text-xs"
        >
          {isLoading ? 'Updating...' : 'Update Password'}
        </Button>
      </div>
    </form>
  );
};
