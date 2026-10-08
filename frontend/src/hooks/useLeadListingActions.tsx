import { useCallback, useState } from 'react';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/components/ui/toast';
import { deleteLead, fetchLead, mapApiLeadToRow } from '@/lib/leadsApi';
import type { Lead } from '@/types';

interface DeleteTarget {
  id: string;
  leadId: string;
  loanNo?: string;
}

export function disbursedLoanDeleteDescription(loanNo: string): string {
  return `Loan ${loanNo} has already been disbursed. Deleting it may permanently remove associated financial and repayment records.\n\nAre you sure you want to continue?`;
}

interface LeadListingActionsOptions {
  onDeleted?: () => void;
  /** Replaces lead delete. Disbursed loans use this to soft-delete the loan. */
  deleteRequest?: (target: DeleteTarget) => Promise<void>;
  deleteTitle?: string | ((target: DeleteTarget) => string);
  deleteConfirmLabel?: string | ((target: DeleteTarget) => string);
  deleteDescription?: (target: DeleteTarget) => string;
  deletedToastTitle?: string | ((target: DeleteTarget) => string);
  deletedToastDescription?: (target: DeleteTarget) => string;
  deleteErrorTitle?: string;
}

function resolveDeleteText(
  value: string | ((target: DeleteTarget) => string) | undefined,
  target: DeleteTarget | null,
  fallback: string,
): string {
  if (typeof value === 'function') {
    return target ? value(target) : fallback;
  }
  return value ?? fallback;
}

/** Shared edit/delete state and dialogs for lead-based listing pages. */
export function useLeadListingActions({
  onDeleted,
  deleteRequest,
  deleteTitle,
  deleteConfirmLabel,
  deleteDescription,
  deletedToastTitle,
  deletedToastDescription,
  deleteErrorTitle = 'Failed to delete lead',
}: LeadListingActionsOptions = {}) {
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openEditByLeadUuid = useCallback(async (leadUuid: string) => {
    try {
      // Direct retrieve (not list search): finance/collection may lack lead.view for list
      // but can retrieve via disbursal.view / loan.view / collection.view.
      const apiLead = await fetchLead(leadUuid);
      setEditLead(mapApiLeadToRow(apiLead));
    } catch (err) {
      toast({
        title: 'Lead not found',
        description: err instanceof Error ? err.message : 'Unable to load lead for editing.',
        variant: 'error',
      });
    }
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteRequest) {
        await deleteRequest(deleteTarget);
      } else {
        await deleteLead(deleteTarget.id);
      }
      toast({
        title: resolveDeleteText(deletedToastTitle, deleteTarget, 'Lead deleted'),
        description:
          deletedToastDescription?.(deleteTarget) ?? `${deleteTarget.leadId} removed.`,
        variant: 'success',
      });
      setDeleteTarget(null);
      onDeleted?.();
    } catch (err) {
      toast({
        title: deleteErrorTitle,
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const dialogs = (
    <>
      <EditLeadDialog
        isOpen={editLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditLead(null);
        }}
        lead={editLead}
        onUpdated={() => {
          setEditLead(null);
          onDeleted?.();
        }}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={resolveDeleteText(deleteTitle, deleteTarget, 'Delete this lead?')}
        description={
          deleteTarget
            ? (deleteDescription?.(deleteTarget)
              ?? `${deleteTarget.leadId} will be permanently removed.`)
            : undefined
        }
        confirmLabel={resolveDeleteText(deleteConfirmLabel, deleteTarget, 'Delete lead')}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );

  return {
    editLead,
    setEditLead,
    deleteTarget,
    setDeleteTarget,
    openEditByLeadUuid,
    dialogs,
  };
}
