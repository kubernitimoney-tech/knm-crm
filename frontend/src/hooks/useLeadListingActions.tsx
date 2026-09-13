import { useCallback, useState } from 'react';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/components/ui/toast';
import { deleteLead, fetchLead, mapApiLeadToRow } from '@/lib/leadsApi';
import type { Lead } from '@/types';

interface LeadListingActionsOptions {
  onDeleted?: () => void;
}

/** Shared edit/delete state and dialogs for lead-based listing pages. */
export function useLeadListingActions({ onDeleted }: LeadListingActionsOptions = {}) {
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; leadId: string } | null>(null);
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
      await deleteLead(deleteTarget.id);
      toast({
        title: 'Lead deleted',
        description: `${deleteTarget.leadId} removed.`,
        variant: 'success',
      });
      setDeleteTarget(null);
      onDeleted?.();
    } catch (err) {
      toast({
        title: 'Failed to delete lead',
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
        title="Delete this lead?"
        description={
          deleteTarget
            ? `${deleteTarget.leadId} will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete lead"
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
