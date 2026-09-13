import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  createLeadRejection,
  fetchLeadRejection,
  mapRejectionFromApi,
} from '@/lib/leadDetailsApi';
import { selectPlaceholder } from '@/lib/placeholders';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { validateCibilScore, normalizeCibilScore } from '@/lib/indiaValidators';
import { REJECTION_REASON_OPTIONS } from '@/features/leads/components/leadSanctionConstants';
import { BranchSelect } from '@/components/branches/BranchSelect';
import { LoadingState } from '@/components/ui/loading-state';
import {
  FormFieldLabel,
  FormSelect,
  GridDetailTable,
  SectionEditButton,
  textareaClassName,
} from '@/features/leads/components/leadDetailSectionShared';

export interface LoanRejectionEntry {
  branch: string;
  officialEmail: string;
  cibilScore: string;
  rejectionReason: string;
  remarks: string;
  rejectedOn: string;
}

interface LeadLoanRejectionSectionProps {
  leadId: string;
  defaultEmail?: string;
  enabled?: boolean;
  /** When true, rejection is offered after sanction or disbursal sheet send. */
  postSanction?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  onCancel?: () => void;
  onRejected?: () => void | Promise<void>;
}

function rejectionToGridItems(entry: LoanRejectionEntry) {
  return [
    { label: 'Branch', value: entry.branch },
    { label: 'Official Email', value: entry.officialEmail },
    { label: 'CIBIL Score', value: entry.cibilScore },
    { label: 'Rejection Reason', value: entry.rejectionReason },
    { label: 'Remarks', value: entry.remarks },
    { label: 'Rejected On', value: formatAppDateTimeOrFallback(entry.rejectedOn) },
  ];
}

export function LeadLoanRejectionSection({
  leadId,
  defaultEmail,
  enabled = true,
  postSanction = false,
  canCreate = false,
  canUpdate = false,
  onCancel,
  onRejected,
}: LeadLoanRejectionSectionProps) {
  const [form, setForm] = useState({
    branch: '',
    officialEmail: defaultEmail ?? '',
    cibilScore: '',
    rejectionReason: '',
    remarks: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<LoanRejectionEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRejection = useCallback(async () => {
    if (!leadId || !enabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const record = await fetchLeadRejection(leadId);
      setRejected(record ? mapRejectionFromApi(record) : null);
      setIsEditing(false);
    } catch {
      setRejected(null);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, enabled]);

  useEffect(() => {
    loadRejection();
  }, [loadRejection]);

  const handleSubmit = async () => {
    if (isEditing ? !canUpdate : !canCreate) {
      setFormError('You do not have permission to perform this action.');
      return;
    }
    const cibilScoreError = validateCibilScore(form.cibilScore, { required: true });
    if (cibilScoreError) {
      setFormError(cibilScoreError);
      return;
    }
    if (!form.branch.trim()) {
      setFormError('Branch is required.');
      return;
    }
    if (!form.rejectionReason) {
      setFormError('Please select rejection reason.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const record = await createLeadRejection(leadId, {
        branch: form.branch,
        officialEmail: form.officialEmail.trim(),
        cibilScore: normalizeCibilScore(form.cibilScore),
        rejectionReason: form.rejectionReason,
        remarks: form.remarks.trim(),
      });
      setRejected(mapRejectionFromApi(record));
      setIsEditing(false);
      await onRejected?.();
      toast({ title: isEditing ? 'Rejection updated' : 'Loan rejected', variant: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save rejection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (rejected && isEditing) {
      setIsEditing(false);
      setFormError(null);
      return;
    }
    setForm({
      branch: '',
      officialEmail: defaultEmail ?? '',
      cibilScore: '',
      rejectionReason: '',
      remarks: '',
    });
    setFormError(null);
    onCancel?.();
  };

  const handleEdit = () => {
    if (!rejected || !canUpdate) return;
    setForm({
      branch: rejected.branch,
      officialEmail: rejected.officialEmail,
      cibilScore: rejected.cibilScore,
      rejectionReason: rejected.rejectionReason,
      remarks: rejected.remarks,
    });
    setFormError(null);
    setIsEditing(true);
  };

  if (isLoading) {
    return <LoadingState layout="section" message="Loading rejection details…" size="sm" />;
  }

  if (!canCreate && !canUpdate) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        You do not have permission to reject this loan.
      </p>
    );
  }

  if (rejected && !isEditing) {
    return (
      <GridDetailTable
        items={rejectionToGridItems(rejected)}
        columnsPerRow={4}
        title="Loan Rejection Details"
        headerClassName="bg-rose-700 dark:bg-rose-800"
        headerAction={
          canUpdate ? (
            <SectionEditButton onClick={handleEdit} title="Edit rejection details" />
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {canCreate || isEditing ? (
        <>
          {isEditing && (
            <p className="text-[11px] font-semibold text-primary-deep dark:text-indigo-300">
              Editing rejection details
            </p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {postSanction
              ? 'Reject this loan after sanction or disbursal sheet send. Select a reason and submit — the application will move to Rejected.'
              : 'Capture rejection details. The form will be hidden after submission.'}
          </p>
          <div className="rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <FormFieldLabel required>Branch</FormFieldLabel>
                <BranchSelect
                  value={form.branch}
                  onChange={(branch) => setForm((prev) => ({ ...prev, branch }))}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Official Email</FormFieldLabel>
                <Input
                  type="email"
                  value={form.officialEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, officialEmail: e.target.value }))}
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>CIBIL Score</FormFieldLabel>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={form.cibilScore}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, cibilScore: normalizeCibilScore(e.target.value) }))
                  }
                  className="h-8 text-[11px]"
                  placeholder="300–900"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Indian CIBIL score: 300 to 900.
                </p>
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>Rejection Reason</FormFieldLabel>
                <FormSelect
                  value={form.rejectionReason}
                  onChange={(rejectionReason) =>
                    setForm((prev) => ({ ...prev, rejectionReason }))
                  }
                  placeholder={selectPlaceholder('Rejection Reason')}
                  options={REJECTION_REASON_OPTIONS}
                />
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <FormFieldLabel>Remarks</FormFieldLabel>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  className={textareaClassName}
                />
              </div>
            </div>

            {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg px-4"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isEditing ? 'Update Rejection' : 'Reject'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          You do not have permission to update rejection details.
        </p>
      )}
    </div>
  );
}
