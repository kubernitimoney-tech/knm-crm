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
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPermission,
  updatePermission,
  type MatrixPermission,
} from '@/lib/permissionsApi';
import { getApiErrorMessage } from '@/lib/api';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { dataTableFilterControlClass } from '@/components/ui/data-table';

interface Option {
  value: string;
  label: string;
}

interface PermissionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleOptions: Option[];
  actionOptions: Option[];
  statusOptions: Option[];
  editing?: MatrixPermission | null;
  onSaved: () => void;
}

export function PermissionFormDialog({
  open,
  onOpenChange,
  moduleOptions,
  actionOptions,
  statusOptions,
  editing = null,
  onSaved,
}: PermissionFormDialogProps) {
  const isEditing = Boolean(editing);
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewCode = useMemo(() => {
    if (!module || !action) return '—';
    return `${module}.${action}`;
  }, [module, action]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setIsSubmitting(false);
    if (editing) {
      setModule(editing.module);
      setAction(editing.action);
      setStatus(editing.status === 'inactive' ? 'inactive' : 'active');
      return;
    }
    setModule('');
    setAction('');
    setStatus('active');
  }, [open, editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!module) {
      setError('Please select a module.');
      return;
    }
    if (!action) {
      setError('Please select an action.');
      return;
    }

    const payload = {
      module,
      action,
      status: (status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    };

    setIsSubmitting(true);
    try {
      if (isEditing && editing) {
        const updated = await updatePermission(editing.id, payload);
        toast({
          title: 'Permission updated',
          description: updated.code,
          variant: 'success',
        });
      } else {
        const created = await createPermission(payload);
        toast({
          title: 'Permission created',
          description: created.code,
          variant: 'success',
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) =>
        handleDialogOpenChange(next, details, { onOpenChange })
      }
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Permission' : 'Add Permission'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update module, action, or status. Code is regenerated as module.action.'
                : 'Choose module and action. Code is generated as module.action.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <FieldLabel required>Module</FieldLabel>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger className={dataTableFilterControlClass}>
                  <SelectValue placeholder={selectPlaceholder('Module')} />
                </SelectTrigger>
                <SelectContent>
                  {moduleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Action</FieldLabel>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className={dataTableFilterControlClass}>
                  <SelectValue placeholder={selectPlaceholder('Action')} />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={dataTableFilterControlClass}>
                  <SelectValue placeholder={selectPlaceholder('Status')} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Code preview:{' '}
              <span className="font-mono font-semibold text-slate-800">{previewCode}</span>
            </p>

            {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-dialog-dismiss
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? 'Saving…'
                  : 'Creating…'
                : isEditing
                  ? 'Save'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
