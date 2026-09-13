import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import {
  createLeadReference,
  deleteLeadReference,
  fetchLeadReferences,
  mapRelationFromApi,
  updateLeadReference,
  type ApiLeadReference,
} from '@/lib/leadDetailsApi';
import {
  AnimatedAddFormPanel,
  EditDeleteActions,
  EmptyTableRow,
  FormFieldLabel,
  FormSelect,
  SectionTable,
  sectionHeadClassName,
  sectionCellClassName,
  useAnimatedFormPanel,
} from '@/features/leads/components/leadDetailSectionShared';
import {
  digitsOnly,
  normalizeIndianMobile,
  validateMobile,
} from '@/lib/indiaValidators';
import { formatPersonName } from '@/lib/utils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export const RELATION_OPTIONS = [
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Spouse',
  'Friend',
  'Colleague',
  'Other',
] as const;

export type RelationType = (typeof RELATION_OPTIONS)[number];

export interface LeadReferenceEntry {
  id: string;
  relation: RelationType;
  referenceName: string;
  referenceMobile: string;
}

const emptyForm = (): Omit<LeadReferenceEntry, 'id' | 'relation'> & { relation: RelationType | '' } => ({
  relation: '',
  referenceName: '',
  referenceMobile: '',
});

function mapApiReference(entry: ApiLeadReference): LeadReferenceEntry {
  return {
    id: entry.id,
    relation: mapRelationFromApi(entry.relation) as RelationType,
    referenceName: entry.reference_name,
    referenceMobile: entry.reference_mobile,
  };
}

interface LeadReferenceDetailsSectionProps {
  leadId: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function LeadReferenceDetailsSection({
  leadId,
  canAdd = false,
  canEdit = false,
  canDelete = false,
}: LeadReferenceDetailsSectionProps) {
  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 4 : 3;
  const [entries, setEntries] = useState<LeadReferenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showForm, formError, setFormError, openForm, closeForm } = useAnimatedFormPanel();

  const loadEntries = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadReferences(leadId);
      setEntries(data.map(mapApiReference));
    } catch (err) {
      toast({
        title: 'Failed to load references',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError(null);
  };

  const handleOpen = () => {
    resetForm();
    openForm();
  };

  const handleClose = () => {
    closeForm(resetForm);
  };

  const handleSubmit = async () => {
    if (!form.relation) {
      setFormError('Please select relation.');
      return;
    }
    if (!form.referenceName.trim()) {
      setFormError('Reference name is required.');
      return;
    }
    const mobileError = validateMobile(form.referenceMobile, { required: true, label: 'Reference mobile number' });
    if (mobileError) {
      setFormError(mobileError);
      return;
    }
    const referenceMobile = normalizeIndianMobile(form.referenceMobile);

    try {
      if (editingId) {
        const updated = await updateLeadReference(leadId, editingId, {
          relation: form.relation as RelationType,
          referenceName: form.referenceName,
          referenceMobile,
        });
        setEntries((prev) =>
          prev.map((entry) => (entry.id === editingId ? mapApiReference(updated) : entry)),
        );
      } else {
        const created = await createLeadReference(leadId, {
          relation: form.relation as RelationType,
          referenceName: form.referenceName,
          referenceMobile,
        });
        setEntries((prev) => [mapApiReference(created), ...prev]);
      }
      closeForm(resetForm);
      toast({ title: editingId ? 'Reference updated' : 'Reference added', variant: 'success' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleEdit = (entry: LeadReferenceEntry) => {
    setForm({
      relation: entry.relation,
      referenceName: entry.referenceName,
      referenceMobile: entry.referenceMobile,
    });
    setEditingId(entry.id);
    openForm();
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteLeadReference(leadId, entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingId === entryId) {
        closeForm(resetForm);
      }
      toast({ title: 'Reference deleted', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <AnimatedAddFormPanel
        showForm={showForm}
        onOpen={handleOpen}
        onClose={handleClose}
        addButtonLabel="Add Reference"
        formTitle={editingId ? 'Edit Reference' : 'Add Reference'}
        submitLabel={editingId ? 'Update Reference' : 'Save Reference'}
        onSubmit={handleSubmit}
        formError={formError}
        description="Add personal or professional references for verification."
        showAddButton={canAdd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <FormFieldLabel required>Relation</FormFieldLabel>
            <FormSelect
              value={form.relation}
              onChange={(relation) =>
                setForm((prev) => ({ ...prev, relation: relation as RelationType | '' }))
              }
              placeholder={selectPlaceholder('Relation')}
              options={RELATION_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Reference Name</FormFieldLabel>
            <Input
              value={form.referenceName}
              onChange={(e) => setForm((prev) => ({ ...prev, referenceName: e.target.value }))}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('Reference Name')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Reference Mobile No.</FormFieldLabel>
            <Input
              value={form.referenceMobile}
              onChange={(e) => setForm((prev) => ({ ...prev, referenceMobile: digitsOnly(e.target.value, 10) }))}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('Reference Mobile No.')}
              maxLength={10}
              inputMode="numeric"
            />
          </div>
        </div>
      </AnimatedAddFormPanel>

      <SectionTable>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className={sectionHeadClassName()}>Relation</TableHead>
            <TableHead className={sectionHeadClassName()}>Reference Name</TableHead>
            <TableHead className={sectionHeadClassName()}>Reference Mobile No.</TableHead>
            {showActionColumn && (
            <TableHead className={sectionHeadClassName('text-center')}>Action</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingRow colSpan={tableColSpan} message="Loading references…" compact />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={tableColSpan} message="No references added yet." />
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
                <TableCell className={sectionCellClassName}>
                  {entry.relation}
                </TableCell>
                <TableCell className={sectionCellClassName}>{formatPersonName(entry.referenceName)}</TableCell>
                <TableCell className={sectionCellClassName}>
                  {entry.referenceMobile}
                </TableCell>
                {showActionColumn && (
                <TableCell>
                  <EditDeleteActions
                    onEdit={() => handleEdit(entry)}
                    onDelete={() => handleDelete(entry.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    deleteTitle="Delete this reference?"
                    deleteDescription="This reference contact will be permanently removed from the lead."
                  />
                </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </SectionTable>
    </div>
  );
}
