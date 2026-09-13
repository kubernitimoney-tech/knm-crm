import React, { useEffect, useMemo, useState } from 'react';
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
import { useBranches } from '@/hooks/useBranches';
import {
  createBranchTarget,
  MONTH_OPTIONS,
  updateBranchTarget,
  type BranchTarget,
} from '@/lib/branchTargetsApi';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export interface BranchTargetFormValues {
  branchId: string;
  targetAmount: string;
  periodYear: number;
  periodMonth: number;
}

interface BranchTargetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTarget: BranchTarget | null;
  onSaved: () => void;
}

function currentPeriod() {
  const now = new Date();
  return {
    periodYear: now.getFullYear(),
    periodMonth: now.getMonth() + 1,
  };
}

const emptyForm = (): BranchTargetFormValues => ({
  branchId: '',
  targetAmount: '',
  ...currentPeriod(),
});

function monthLabel(month: number): string {
  return MONTH_OPTIONS.find((item) => item.value === month)?.label ?? String(month);
}

export function BranchTargetFormDialog({
  open,
  onOpenChange,
  editingTarget,
  onSaved,
}: BranchTargetFormDialogProps) {
  const { branches, isLoading: branchesLoading } = useBranches();
  const [form, setForm] = useState<BranchTargetFormValues>(emptyForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(editingTarget);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId) ?? null,
    [branches, form.branchId],
  );

  const selectedBranchLabel = selectedBranch
    ? selectedBranch.branch_name
    : editingTarget && form.branchId
      ? editingTarget.branchName
      : '';

  const selectedMonthLabel = monthLabel(form.periodMonth);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingTarget) {
      setForm({
        branchId: editingTarget.branchId,
        targetAmount: String(editingTarget.target),
        periodYear: editingTarget.periodYear,
        periodMonth: editingTarget.periodMonth,
      });
      return;
    }
    // Create: empty branch + locked current calendar month/year
    setForm(emptyForm());
  }, [open, editingTarget]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const amount = Number(form.targetAmount.replace(/,/g, ''));
    if (!form.branchId) {
      setError('Please select a branch.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid target amount greater than zero.');
      return;
    }

    // Always submit the locked period shown on the form (current for create).
    const { periodYear, periodMonth } = isEditing
      ? { periodYear: form.periodYear, periodMonth: form.periodMonth }
      : currentPeriod();

    setIsSubmitting(true);
    try {
      const payload = {
        branch: form.branchId,
        target_amount: amount,
        period_year: periodYear,
        period_month: periodMonth,
      };

      if (editingTarget) {
        await updateBranchTarget(editingTarget.id, {
          target_amount: amount,
        });
      } else {
        await createBranchTarget(payload);
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch target.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeDialog = () => {
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        handleDialogOpenChange(nextOpen, eventDetails, {
          onOpenChange,
          onDismiss: () => setError(''),
        });
      }}
    >
      <DialogContent className="sm:max-w-[520px] rounded-3xl border-slate-200 p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-black text-primary-deep tracking-tight">
              {isEditing ? 'Edit Branch Target' : 'Define Branch Target'}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              Set the monthly sanction target for a branch. One target per branch per month.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-5">
            <div className="space-y-2">
              <FieldLabel required>Branch</FieldLabel>
              <Select
                value={form.branchId || null}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, branchId: value ?? '' }))
                }
                disabled={branchesLoading || branches.length === 0 || isEditing}
              >
                <SelectTrigger
                  size="lg"
                  className="h-11 w-full rounded-xl border-slate-200 text-sm font-semibold"
                >
                  <SelectValue
                    placeholder={
                      branchesLoading
                        ? 'Loading branches...'
                        : selectPlaceholder('Branch')
                    }
                  >
                    {selectedBranchLabel || undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id} label={branch.branch_name}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Monthly Target (INR)</FieldLabel>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.targetAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                placeholder={enterPlaceholder('Monthly Target')}
                className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel required>Month</FieldLabel>
                <Input
                  value={selectedMonthLabel}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel required>Year</FieldLabel>
                <Input
                  value={String(form.periodYear)}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm font-semibold text-rose-600 rounded-xl bg-rose-50 px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              data-dialog-dismiss="true"
              className="h-11 min-w-[110px] rounded-xl font-bold text-xs uppercase tracking-widest"
              onClick={closeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 min-w-[130px] rounded-xl bg-primary-deep hover:bg-secondary-dark font-bold text-xs uppercase tracking-widest px-6"
              disabled={isSubmitting || branchesLoading}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Target' : 'Save Target'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
