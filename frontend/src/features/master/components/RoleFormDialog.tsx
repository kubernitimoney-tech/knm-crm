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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createRole } from '@/lib/permissionsApi';
import { getApiErrorMessage } from '@/lib/api';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function RoleFormDialog({ open, onOpenChange, onCreated }: RoleFormDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewSlug = useMemo(() => {
    if (slugTouched) return toSlug(slug) || '—';
    return toSlug(name) || '—';
  }, [name, slug, slugTouched]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDisplayName('');
    setSlug('');
    setSlugTouched(false);
    setDescription('');
    setStatus('active');
    setError('');
    setIsSubmitting(false);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const roleName = name.trim();
    if (!roleName) {
      setError('Please enter a role name.');
      return;
    }

    const finalSlug = slugTouched ? toSlug(slug) : toSlug(roleName);
    if (!finalSlug) {
      setError('Please enter a valid slug.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createRole({
        name: roleName,
        display_name: displayName.trim() || roleName,
        slug: finalSlug,
        description: description.trim(),
        status,
      });
      toast({
        title: 'Role created',
        description: `${created.name} (${created.slug}). Assign permissions via the matrix.`,
        variant: 'success',
      });
      onOpenChange(false);
      onCreated();
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
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Create a system role. Permissions can be granted from the permission matrix.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <FieldLabel required>Role name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={enterPlaceholder('Role name')}
                className={cn(dataTableFilterControlClass, 'h-9')}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Display name</FieldLabel>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={enterPlaceholder('Short label (optional)')}
                className={cn(dataTableFilterControlClass, 'h-9')}
                maxLength={50}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Slug</FieldLabel>
              <Input
                value={slugTouched ? slug : toSlug(name)}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder={enterPlaceholder('role-slug')}
                className={cn(dataTableFilterControlClass, 'h-9 font-mono text-[11px]')}
                maxLength={100}
              />
              <p className="text-[11px] text-slate-500">
                Machine id used in APIs. Preview:{' '}
                <span className="font-mono font-semibold text-slate-700">{previewSlug}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Description</FieldLabel>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={enterPlaceholder('Description (optional)')}
                className={cn(dataTableFilterControlClass, 'h-9')}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v === 'inactive' ? 'inactive' : 'active')}
              >
                <SelectTrigger className={dataTableFilterControlClass}>
                  <SelectValue placeholder={selectPlaceholder('Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
              {isSubmitting ? 'Creating…' : 'Create Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
