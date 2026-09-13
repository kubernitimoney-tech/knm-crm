import React, { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { fetchUsers } from '@/lib/usersApi';
import { transferLead } from '@/lib/leadsApi';
import type { Lead } from '@/types';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface TransferLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onTransferred: () => void;
}

const RM_ROLE_SLUGS = ['relationship-manager', 'senior-relationship-manager'];

export const TransferLeadDialog = ({
  isOpen,
  onOpenChange,
  lead,
  onTransferred,
}: TransferLeadDialogProps) => {
  const [rms, setRms] = useState<{ id: string; label: string }[]>([]);
  const [newRm, setNewRm] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rmSelectOpen, setRmSelectOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNewRm('');
    setRemarks('');
    setError('');
    fetchUsers({ page_size: 100, is_active: true })
      .then((res) => {
        const managers = res.results
          .filter((u) => u.roles.some((r) => RM_ROLE_SLUGS.includes(r.slug)))
          .filter((u) => u.id !== lead?.assignedRmId)
          .map((u) => ({ id: u.id, label: u.full_name || u.email }));
        setRms(managers);
      })
      .catch(() => setRms([]));
  }, [isOpen, lead?.assignedRmId]);

  const dismissDialog = () => {
    setRmSelectOpen(false);
    setError('');
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!newRm) {
      setError('Please select a relationship manager.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await transferLead(lead.id, newRm, remarks);
      toast({
        title: 'Lead transferred',
        description: `${lead.leadId} reassigned successfully.`,
        variant: 'success',
      });
      onTransferred();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer lead');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      modal="trap-focus"
      onOpenChange={(open, eventDetails) => {
        handleDialogOpenChange(open, eventDetails as DialogChangeEventDetails, {
          selectOpen: rmSelectOpen,
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[480px] bg-white border-slate-200 rounded-[28px] shadow-2xl p-0 overflow-visible font-sans">
        <DialogHeader className="p-7 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className="w-11 h-11 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep ring-1 ring-primary-deep/10">
            <ArrowRightLeft size={20} />
          </div>
          <DialogTitle className="text-xl font-black text-primary-deep tracking-tight mt-3">
            Transfer Lead
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            {lead
              ? `${lead.leadId} • ${lead.pipelineStatus ?? '—'} • currently ${lead.assignedRM}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {error && (
            <div className="mx-7 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          <div className="p-7 space-y-5">
            <div className="space-y-2">
              <FieldLabel variant="dialog" required>New Relationship Manager</FieldLabel>
              <Select
                modal={false}
                open={rmSelectOpen}
                onOpenChange={setRmSelectOpen}
                value={newRm}
                onValueChange={setNewRm}
              >
                <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                  <SelectValue placeholder={selectPlaceholder('Relationship Manager')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                  {rms.length > 0 ? (
                    rms.map((rm) => (
                      <SelectItem key={rm.id} value={rm.id}>{rm.label}</SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[11px] font-medium text-slate-400">No other RMs available</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel variant="dialog">Remarks (optional)</FieldLabel>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder={enterPlaceholder('Reason for Transfer')}
                className="w-full text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-primary-deep resize-none leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="p-7 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              data-dialog-dismiss="true"
              onClick={closeDialog}
              className="h-11 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !newRm}
              className="h-11 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs gap-2 px-6"
            >
              {isLoading ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
