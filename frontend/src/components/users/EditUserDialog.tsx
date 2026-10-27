import { useEffect, useState, type SyntheticEvent } from 'react';
import { PenLine } from 'lucide-react';
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
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { fetchBranches, type ApiBranch } from '@/lib/branchesApi';
import { digitsOnly, normalizeIndianMobile, validateMobile } from '@/lib/indiaValidators';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { updateUser, type ApiUser } from '@/lib/usersApi';

const INPUT_CLASS =
  'h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ApiUser;
  onSaved: (user: ApiUser) => void;
}

function formFromUser(user: ApiUser) {
  return {
    firstName: user.first_name,
    middleName: user.middle_name,
    lastName: user.last_name,
    displayName: user.display_name ?? '',
    mobile: user.mobile_number,
    branchId: user.branch?.id ?? '',
    address: user.address,
  };
}

/** Email, username and account status are not editable here. */
export const EditUserDialog = ({ open, onOpenChange, user, onSaved }: EditUserDialogProps) => {
  const [form, setForm] = useState(() => formFromUser(user));
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [branchSelectOpen, setBranchSelectOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formFromUser(user));
    setError('');
    fetchBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [open, user]);

  const update = (patch: Partial<ReturnType<typeof formFromUser>>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  const branchName =
    branches.find((branch) => branch.id === form.branchId)?.branch_name ?? user.branch?.name ?? '';

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError =
      (form.firstName.trim() ? null : 'First name is required.')
      ?? validateMobile(form.mobile, { required: true, label: 'Mobile number' })
      ?? (form.branchId ? null : 'Select a branch.');
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const saved = await updateUser(user.id, {
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        display_name: form.displayName.trim(),
        mobile_number: normalizeIndianMobile(form.mobile),
        branch: form.branchId,
        address: form.address.trim(),
      });
      toast({ title: 'User updated', variant: 'success' });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      modal="trap-focus"
      onOpenChange={(nextOpen, eventDetails) => {
        handleDialogOpenChange(nextOpen, eventDetails, {
          selectOpen: branchSelectOpen,
          onOpenChange,
        });
      }}
    >
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="shrink-0 p-8 pb-4 bg-slate-50/50 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-primary-deep">
            <PenLine size={18} />
            Edit User
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium">
            {user.email} · @{user.username} — email and username cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-4">
            {error ? (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <FieldLabel variant="dialog" required>First Name</FieldLabel>
                <Input value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div className="space-y-2">
                <FieldLabel variant="dialog">Middle Name</FieldLabel>
                <Input value={form.middleName} onChange={(e) => update({ middleName: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div className="space-y-2">
                <FieldLabel variant="dialog">Last Name</FieldLabel>
                <Input value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} className={INPUT_CLASS} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel variant="dialog">Display Name</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('Display Name')}
                  value={form.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Mobile Number</FieldLabel>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) => update({ mobile: digitsOnly(e.target.value, 10) })}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel variant="dialog" required>Branch</FieldLabel>
              <Select
                modal={false}
                open={branchSelectOpen}
                onOpenChange={setBranchSelectOpen}
                value={form.branchId}
                onValueChange={(value) => update({ branchId: String(value ?? '') })}
              >
                <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                  <SelectValue placeholder={selectPlaceholder('Branch')}>{branchName || undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branch_name} ({branch.branch_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel variant="dialog">Address</FieldLabel>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.address}
                onChange={(e) => update({ address: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-deep/10 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 p-8 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
            <Button type="button" variant="ghost" data-dialog-dismiss="true" onClick={() => onOpenChange(false)} className="h-11 rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="h-11 rounded-xl text-xs font-bold bg-primary-deep text-white px-6">
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
