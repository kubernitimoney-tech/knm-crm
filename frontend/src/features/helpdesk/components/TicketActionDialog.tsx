import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { textareaClassName } from '@/features/leads/components/leadDetailSectionShared';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { selectPlaceholder } from '@/lib/placeholders';
import { getApiErrorMessage } from '@/lib/api';
import {
  assignTicket,
  fetchTicketAssignees,
  resolveTicket,
  transitionTicket,
  type TicketCorrection,
  type TicketDetail,
  type TicketUser,
} from '@/lib/helpdeskApi';

export type TicketDialogAction = 'assign' | 'hold' | 'resolve' | 'close' | 'reopen' | 'cancel';

interface ActionCopy {
  title: string;
  description: string;
  remarkLabel: string;
  remarkRequired: boolean;
  confirmLabel: string;
  danger?: boolean;
}

const COPY: Record<TicketDialogAction, ActionCopy> = {
  assign: {
    title: 'Assign Ticket',
    description: 'Hand this ticket to an IT Support member.',
    remarkLabel: '',
    remarkRequired: false,
    confirmLabel: 'Assign',
  },
  hold: {
    title: 'Put On Hold',
    description: 'Tell the raiser what you are waiting for.',
    remarkLabel: 'Hold reason',
    remarkRequired: true,
    confirmLabel: 'Put On Hold',
  },
  resolve: {
    title: 'Resolve Ticket',
    description:
      'Explain what was corrected. The raiser confirms the fix, or the ticket auto-closes after 3 working days.',
    remarkLabel: 'Resolution remark',
    remarkRequired: true,
    confirmLabel: 'Mark Resolved',
  },
  close: {
    title: 'Confirm & Close',
    description: 'Confirm the issue is fixed. A closed ticket cannot be reopened.',
    remarkLabel: 'Closing note',
    remarkRequired: false,
    confirmLabel: 'Close Ticket',
  },
  reopen: {
    title: 'Reopen Ticket',
    description: 'Tell IT Support what is still wrong.',
    remarkLabel: 'Reopen reason',
    remarkRequired: true,
    confirmLabel: 'Reopen',
    danger: true,
  },
  cancel: {
    title: 'Cancel Ticket',
    description: 'Withdraw this ticket before IT Support starts on it.',
    remarkLabel: 'Reason',
    remarkRequired: false,
    confirmLabel: 'Cancel Ticket',
    danger: true,
  },
};

interface TicketActionDialogProps {
  ticket: TicketDetail;
  action: TicketDialogAction | null;
  onOpenChange: (open: boolean) => void;
  onDone: (ticket: TicketDetail) => void;
}

const emptyCorrection = (): TicketCorrection => ({ field: '', before: '', after: '' });

export function TicketActionDialog({ ticket, action, onOpenChange, onDone }: TicketActionDialogProps) {
  const [remark, setRemark] = useState('');
  const [corrections, setCorrections] = useState<TicketCorrection[]>([]);
  const [assignee, setAssignee] = useState('');
  const [assignees, setAssignees] = useState<TicketUser[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!action) return;
    setRemark('');
    setCorrections([]);
    setAssignee(ticket.assigned_to?.id ?? '');
    setError('');
    if (action === 'assign') {
      fetchTicketAssignees()
        .then((users) => setAssignees(users.filter((u) => u.id !== ticket.raised_by.id)))
        .catch(() => setAssignees([]));
    }
  }, [action, ticket.assigned_to?.id, ticket.raised_by.id]);

  if (!action) return null;
  const copy = COPY[action];

  const updateCorrection = (index: number, patch: Partial<TicketCorrection>) =>
    setCorrections((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (action === 'assign' && !assignee) return setError('Choose who should work on it.');
    if (copy.remarkRequired && !remark.trim()) return setError(`${copy.remarkLabel} is required.`);

    setIsSubmitting(true);
    try {
      let updated: TicketDetail;
      if (action === 'assign') {
        updated = await assignTicket(ticket.id, assignee);
      } else if (action === 'resolve') {
        const filled = corrections
          .map((c) => ({ field: c.field.trim(), before: c.before.trim(), after: c.after.trim() }))
          .filter((c) => c.field);
        updated = await resolveTicket(ticket.id, remark.trim(), filled);
      } else {
        updated = await transitionTicket(ticket.id, action, remark.trim());
      }
      onDone(updated);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(action)}
      onOpenChange={(nextOpen, eventDetails) => {
        handleDialogOpenChange(nextOpen, eventDetails, {
          onOpenChange,
          onDismiss: () => setError(''),
        });
      }}
    >
      <DialogContent className="sm:max-w-[560px] rounded-3xl border-slate-200 p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-black text-primary-deep tracking-tight">
              {copy.title} · {ticket.ticket_no}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              {copy.description}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
            {action === 'assign' ? (
              <div className="space-y-2">
                <FieldLabel required>Assignee</FieldLabel>
                <AppSelect
                  value={assignee}
                  onValueChange={setAssignee}
                  placeholder={selectPlaceholder('IT Support user')}
                  options={assignees.map((u) => ({ value: u.id, label: u.name }))}
                  elevated
                />
              </div>
            ) : (
              <div className="space-y-2">
                <FieldLabel required={copy.remarkRequired}>{copy.remarkLabel}</FieldLabel>
                <textarea
                  rows={4}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className={textareaClassName}
                  autoFocus
                />
              </div>
            )}

            {action === 'resolve' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Values changed (optional)</FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-semibold"
                    onClick={() => setCorrections((rows) => [...rows, emptyCorrection()])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add change
                  </Button>
                </div>
                {corrections.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Input
                      value={row.field}
                      onChange={(e) => updateCorrection(index, { field: e.target.value })}
                      placeholder="Field"
                      className="h-9 rounded-lg text-xs"
                      maxLength={100}
                    />
                    <Input
                      value={row.before}
                      onChange={(e) => updateCorrection(index, { before: e.target.value })}
                      placeholder="Before"
                      className="h-9 rounded-lg text-xs"
                      maxLength={255}
                    />
                    <Input
                      value={row.after}
                      onChange={(e) => updateCorrection(index, { after: e.target.value })}
                      placeholder="After"
                      className="h-9 rounded-lg text-xs"
                      maxLength={255}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-slate-400 hover:text-rose-600"
                      onClick={() => setCorrections((rows) => rows.filter((_, i) => i !== index))}
                      aria-label="Remove change"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

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
              Back
            </Button>
            <Button
              type="submit"
              className={
                copy.danger
                  ? 'h-11 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs uppercase tracking-widest px-6'
                  : 'h-11 rounded-xl bg-primary-deep hover:bg-secondary-dark font-bold text-xs uppercase tracking-widest px-6'
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : copy.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
