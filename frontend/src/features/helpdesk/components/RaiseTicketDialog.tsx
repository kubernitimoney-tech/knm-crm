import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Paperclip } from 'lucide-react';
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
import { AppSelect } from '@/components/ui/app-select';
import { toast } from '@/components/ui/toast';
import { textareaClassName } from '@/features/leads/components/leadDetailSectionShared';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { getApiErrorMessage } from '@/lib/api';
import {
  fetchTicketCategories,
  raiseTicket,
  uploadTicketAttachment,
  TICKET_ATTACHMENT_ACCEPT,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_DEPARTMENT_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  type TicketCategory,
  type TicketDepartment,
  type TicketDetail,
  type TicketLinkedType,
  type TicketPriority,
} from '@/lib/helpdeskApi';

export interface RaiseTicketPrefill {
  department?: TicketDepartment;
  linkedType?: TicketLinkedType;
  linkedId?: string;
  linkedLabel?: string;
  referenceText?: string;
  relatedTicketId?: string;
  relatedTicketNo?: string;
}

interface RaiseTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaised?: (ticket: TicketDetail) => void;
  prefill?: RaiseTicketPrefill;
}

interface FormState {
  department: TicketDepartment | '';
  category: string;
  priority: TicketPriority | '';
  subject: string;
  description: string;
  referenceText: string;
}

const emptyForm = (prefill?: RaiseTicketPrefill): FormState => ({
  department: prefill?.department ?? '',
  category: '',
  priority: '',
  subject: '',
  description: '',
  referenceText: prefill?.referenceText ?? '',
});

export function RaiseTicketDialog({ open, onOpenChange, onRaised, prefill }: RaiseTicketDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(prefill));
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(prefill));
    setFile(null);
    setError('');
    fetchTicketCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, prefill]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => !form.department || c.department === form.department)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, form.department],
  );

  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    setForm((prev) => ({
      ...prev,
      category: categoryId,
      department: category?.department ?? prev.department,
      priority: category?.default_priority ?? prev.priority,
      subject: prev.subject || category?.name || '',
    }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > TICKET_ATTACHMENT_MAX_BYTES) {
      setError('The attachment must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(picked);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.category) return setError('Please choose the issue category.');
    if (!form.subject.trim()) return setError('Please enter a subject.');
    if (!form.description.trim()) return setError('Please describe the issue.');

    setIsSubmitting(true);
    try {
      const ticket = await raiseTicket({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority || undefined,
        linked_type: prefill?.linkedId ? prefill.linkedType : undefined,
        linked_id: prefill?.linkedId,
        reference_text: form.referenceText.trim(),
        related_ticket: prefill?.relatedTicketId,
      });
      if (file) {
        try {
          await uploadTicketAttachment(ticket.id, file);
        } catch (err) {
          toast({
            title: 'Ticket raised, attachment failed',
            description: getApiErrorMessage(err),
            variant: 'error',
          });
        }
      }
      toast({
        title: `Ticket ${ticket.ticket_no} raised`,
        description: 'IT Support has been notified.',
        variant: 'success',
      });
      onRaised?.(ticket);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
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
      <DialogContent className="sm:max-w-[600px] rounded-3xl border-slate-200 p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-black text-primary-deep tracking-tight">
              Raise Help Desk Ticket
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              Describe what you could not change in the portal. IT Support will fix it and you
              confirm the fix.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
            {(prefill?.linkedLabel || prefill?.relatedTicketNo) && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                {prefill?.linkedLabel && <span>Linked to {prefill.linkedLabel}</span>}
                {prefill?.relatedTicketNo && <span>Follow-up of {prefill.relatedTicketNo}</span>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>Department</FieldLabel>
                <AppSelect
                  value={form.department}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      department: value as TicketDepartment,
                      category: '',
                    }))
                  }
                  placeholder={selectPlaceholder('Department')}
                  options={TICKET_DEPARTMENT_OPTIONS}
                  elevated
                />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Issue Category</FieldLabel>
                <AppSelect
                  value={form.category}
                  onValueChange={handleCategoryChange}
                  placeholder={selectPlaceholder('Category')}
                  options={categoryOptions}
                  elevated
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel required>Subject</FieldLabel>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder={enterPlaceholder('Subject')}
                  className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Priority</FieldLabel>
                <AppSelect
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, priority: value as TicketPriority }))
                  }
                  placeholder={selectPlaceholder('Priority')}
                  options={TICKET_PRIORITY_OPTIONS}
                  elevated
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Description</FieldLabel>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What did you try, what went wrong, and what should the correct value be?"
                className={textareaClassName}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Reference</FieldLabel>
              <Input
                value={form.referenceText}
                onChange={(e) => setForm((prev) => ({ ...prev, referenceText: e.target.value }))}
                placeholder="Loan no., UTR, customer mobile…"
                className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Attachment</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
                <Paperclip className="h-4 w-4" />
                <span className="truncate">
                  {file ? file.name : 'Screenshot or file (PDF, PNG, JPG, XLSX, CSV — max 5 MB)'}
                </span>
                <input
                  type="file"
                  accept={TICKET_ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {error && (
              <p className="text-sm font-semibold text-rose-600 rounded-xl bg-rose-50 px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              type="button"
              variant="outline"
              data-dialog-dismiss="true"
              className="h-11 rounded-xl font-bold text-xs uppercase tracking-widest"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl bg-primary-deep hover:bg-secondary-dark font-bold text-xs uppercase tracking-widest px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Raising…' : 'Raise Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
