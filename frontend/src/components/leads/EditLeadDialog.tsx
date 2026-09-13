import React, { useEffect, useState } from 'react';
import { PenLine, Wallet, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { getApiErrorMessage } from '@/lib/api';
import { fetchLeadSources, updateLead, type LeadSource } from '@/lib/leadsApi';
import type { Lead } from '@/types';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { selectPlaceholder } from '@/lib/placeholders';
import { EDIT_DIALOG_ICON_WRAP_CLASS } from '@/lib/uiTokens';

interface EditLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onUpdated: () => void;
}

export const EditLeadDialog = ({ isOpen, onOpenChange, lead, onUpdated }: EditLeadDialogProps) => {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [requiredAmount, setRequiredAmount] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sourceSelectOpen, setSourceSelectOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !lead) return;
    setError('');
    fetchLeadSources()
      .then((all) => {
        setSources(all);
        const matched = all.find((s) => s.name === lead.source);
        setSource(matched ? matched.id : '');
      })
      .catch(() => setSources([]));
    setRequiredAmount(lead.requiredAmount ? String(lead.requiredAmount) : '');
  }, [isOpen, lead]);

  const dismissDialog = () => {
    setSourceSelectOpen(false);
    setError('');
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setError('');
    setIsLoading(true);
    try {
      await updateLead(lead.id, {
        required_amount: requiredAmount ? Number(requiredAmount) : null,
        source: source || null,
      });
      toast({ title: 'Lead updated', description: `${lead.leadId} saved successfully.`, variant: 'success' });
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
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
          selectOpen: sourceSelectOpen,
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[520px] bg-white border-slate-200 rounded-[28px] shadow-2xl p-0 overflow-visible font-sans">
        <DialogHeader className="p-7 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ring-amber-200 dark:ring-amber-800', EDIT_DIALOG_ICON_WRAP_CLASS)}>
            <PenLine size={20} />
          </div>
          <DialogTitle className="text-xl font-black text-primary-deep tracking-tight mt-3">
            Edit Lead
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            {lead ? `${lead.leadId} • ${lead.customerName}` : ''}
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
              <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Required Amount (₹)</Label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                <Input
                  type="number"
                  min="0"
                  value={requiredAmount}
                  onChange={(e) => setRequiredAmount(e.target.value)}
                  className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Lead Source</Label>
              <div className="relative">
                <Search className="absolute left-4 z-10 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                <Select
                  modal={false}
                  open={sourceSelectOpen}
                  onOpenChange={setSourceSelectOpen}
                  value={source}
                  onValueChange={setSource}
                >
                  <SelectTrigger className={cn('w-full pl-12', dataTableFilterControlClass)}>
                    <SelectValue placeholder={selectPlaceholder('Source')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              disabled={isLoading}
              className="h-11 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs gap-2 px-6"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
