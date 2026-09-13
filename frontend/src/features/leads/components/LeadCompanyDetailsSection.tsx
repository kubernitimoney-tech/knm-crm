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
  createLeadCompany,
  deleteLeadCompany,
  fetchLeadCompanies,
  updateLeadCompany,
  type ApiLeadCompany,
} from '@/lib/leadDetailsApi';
import {
  AnimatedAddFormPanel,
  EditDeleteActions,
  EmptyTableRow,
  EntryStatus,
  FormFieldLabel,
  FormSelect,
  SectionTable,
  StatusBadge,
  sectionHeadClassName,
  sectionCellClassName,
  binaryStatusOptions,
  textareaClassName,
  useAnimatedFormPanel,
} from '@/features/leads/components/leadDetailSectionShared';
import { cn } from '@/lib/utils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export interface LeadCompanyEntry {
  id: string;
  companyName: string;
  companyAddress: string;
  status: EntryStatus;
}

const emptyForm = (): Omit<LeadCompanyEntry, 'id' | 'status'> & { status: EntryStatus | '' } => ({
  companyName: '',
  companyAddress: '',
  status: '',
});

function mapApiCompany(entry: ApiLeadCompany): LeadCompanyEntry {
  return {
    id: entry.id,
    companyName: entry.company_name,
    companyAddress: entry.company_address,
    status: entry.status,
  };
}

interface LeadCompanyDetailsSectionProps {
  leadId: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function LeadCompanyDetailsSection({
  leadId,
  canAdd = false,
  canEdit = false,
  canDelete = false,
}: LeadCompanyDetailsSectionProps) {
  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 4 : 3;
  const [entries, setEntries] = useState<LeadCompanyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showForm, formError, setFormError, openForm, closeForm } = useAnimatedFormPanel();

  const loadEntries = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadCompanies(leadId);
      setEntries(data.map(mapApiCompany));
    } catch (err) {
      toast({
        title: 'Failed to load company details',
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
    if (!form.companyName.trim()) {
      setFormError('Company name is required.');
      return;
    }
    if (!form.status) {
      setFormError('Please select status.');
      return;
    }

    try {
      if (editingId) {
        const updated = await updateLeadCompany(leadId, editingId, {
          companyName: form.companyName,
          companyAddress: form.companyAddress,
          status: form.status as EntryStatus,
        });
        setEntries((prev) =>
          prev.map((entry) => (entry.id === editingId ? mapApiCompany(updated) : entry)),
        );
      } else {
        const created = await createLeadCompany(leadId, {
          companyName: form.companyName,
          companyAddress: form.companyAddress,
          status: form.status as EntryStatus,
        });
        setEntries((prev) => [mapApiCompany(created), ...prev]);
      }
      closeForm(resetForm);
      toast({ title: editingId ? 'Company updated' : 'Company added', variant: 'success' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleEdit = (entry: LeadCompanyEntry) => {
    setForm({
      companyName: entry.companyName,
      companyAddress: entry.companyAddress,
      status: entry.status,
    });
    setEditingId(entry.id);
    openForm();
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteLeadCompany(leadId, entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingId === entryId) {
        closeForm(resetForm);
      }
      toast({ title: 'Company deleted', variant: 'success' });
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
        addButtonLabel="Add Company"
        formTitle={editingId ? 'Edit Company' : 'Add Company'}
        submitLabel={editingId ? 'Update Company' : 'Save Company'}
        onSubmit={handleSubmit}
        formError={formError}
        description="Manage employer and company information for this lead."
        showAddButton={canAdd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FormFieldLabel required>Company Name</FormFieldLabel>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('Company Name')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Status</FormFieldLabel>
            <FormSelect
              value={form.status}
              onChange={(status) =>
                setForm((prev) => ({ ...prev, status: status as EntryStatus | '' }))
              }
              placeholder={selectPlaceholder('Status')}
              options={binaryStatusOptions()}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <FormFieldLabel>Company Address</FormFieldLabel>
            <textarea
              value={form.companyAddress}
              onChange={(e) => setForm((prev) => ({ ...prev, companyAddress: e.target.value }))}
              className={textareaClassName}
              placeholder={enterPlaceholder('Company Address')}
            />
          </div>
        </div>
      </AnimatedAddFormPanel>

      <SectionTable>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className={sectionHeadClassName()}>Company Name</TableHead>
            <TableHead className={sectionHeadClassName()}>Company Address</TableHead>
            <TableHead className={sectionHeadClassName()}>Status</TableHead>
            {showActionColumn && (
            <TableHead className={sectionHeadClassName('text-center')}>Action</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingRow colSpan={tableColSpan} message="Loading company details…" compact />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={tableColSpan} message="No company details added yet." />
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
                <TableCell className={sectionCellClassName}>
                  {entry.companyName}
                </TableCell>
                <TableCell className={cn(sectionCellClassName, 'max-w-[280px]')}>
                  <span className="line-clamp-2">{entry.companyAddress || '—'}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={entry.status} />
                </TableCell>
                {showActionColumn && (
                <TableCell>
                  <EditDeleteActions
                    onEdit={() => handleEdit(entry)}
                    onDelete={() => handleDelete(entry.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    deleteTitle="Delete this company?"
                    deleteDescription="This company detail will be permanently removed from the lead."
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
