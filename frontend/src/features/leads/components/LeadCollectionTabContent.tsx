import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, MessageSquare, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/components/ui/toast';
import { LoadingState } from '@/components/ui/loading-state';
import { getApiErrorMessage } from '@/lib/api';
import {
  createLeadCollection,
  updateLeadCollection,
  deleteLeadCollection,
  createLeadFollowUpRemark,
  updateLeadFollowUpRemark,
  deleteLeadFollowUpRemark,
  fetchLeadCollections,
  fetchLeadDisbursal,
  fetchLeadFollowUpRemarks,
  mapCollectionFromApi,
  mapFollowUpRemarkFromApi,
} from '@/lib/leadDetailsApi';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  COLLECTION_MODE_OPTIONS,
  COLLECTION_SOURCE_OPTIONS,
  collectionStatusOptionsForRepayDate,
  isCollectionStatusAllowedForRepayDate,
  REMARK_CATEGORY_OPTIONS,
  REMARK_PRIORITY_OPTIONS,
  normalizeRemarkCategoryForForm,
  normalizeRemarkPriorityForForm,
  normalizeRemarkFollowUpDateForForm,
  normalizeCollectionModeForForm,
  normalizeCollectionStatusForForm,
  normalizeCollectionSourceForForm,
} from '@/features/leads/components/leadDisbursalConstants';
import {
  FormFieldLabel,
  FormSelect,
  EditDeleteActions,
  HeavyNavTableSection,
  sectionHeadClassName,
  sectionCellClassName,
  textareaClassName,
} from '@/features/leads/components/leadDetailSectionShared';
import { cn } from '@/lib/utils';
import { remarkPriorityBadgeClass } from '@/lib/badgeStyles';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback, fromDateTimeLocalInputValue, toDateTimeLocalInputValue, validateDateTimeLocalNotAfterNow, currentDateTimeLocalInputValue } from '@/lib/dateUtils';
import { selectPlaceholder } from '@/lib/placeholders';

export interface LeadCollectionEntry {
  id: string;
  tillDateAmount: string;
  collectedAmount: string;
  penaltyAmount: string;
  collectionMode: string;
  utrNumber: string;
  collectionDateTime: string;
  waveOff: string;
  settlementAmount: string;
  status: string;
  collectionSource: string;
  remarks: string;
  recordedOn: string;
}

export interface LeadRemarkEntry {
  id: string;
  remarkCategory: string;
  followUpDate: string;
  priority: string;
  notes: string;
  recordedOn: string;
}

interface LeadCollectionTabContentProps {
  leadId: string;
  defaultTillDateAmount?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  canRemarkEdit?: boolean;
  canRemarkDelete?: boolean;
  onCollectionSaved?: (statusDisplay: string, status: string) => void;
}

const emptyCollectionForm = (defaultTillDateAmount?: string) => ({
  tillDateAmount: defaultTillDateAmount ?? '',
  collectedAmount: '',
  penaltyAmount: '',
  collectionMode: '',
  utrNumber: '',
  collectionDateTime: '',
  waveOff: '',
  settlementAmount: '',
  status: '',
  collectionSource: '',
  remarks: '',
});

const emptyRemarkForm = () => ({
  remarkCategory: '',
  followUpDate: '',
  priority: '',
  notes: '',
});

function remarkEntryToForm(entry: LeadRemarkEntry) {
  return {
    remarkCategory: normalizeRemarkCategoryForForm(entry.remarkCategory),
    followUpDate: normalizeRemarkFollowUpDateForForm(entry.followUpDate),
    priority: normalizeRemarkPriorityForForm(entry.priority),
    notes: entry.notes,
  };
}

function collectionEntryToForm(entry: LeadCollectionEntry) {
  return {
    tillDateAmount: entry.tillDateAmount,
    collectedAmount: entry.collectedAmount,
    penaltyAmount: entry.penaltyAmount,
    collectionMode: normalizeCollectionModeForForm(entry.collectionMode),
    utrNumber: entry.utrNumber,
    collectionDateTime: toDateTimeLocalInputValue(entry.collectionDateTime),
    waveOff: entry.waveOff,
    settlementAmount: entry.settlementAmount,
    status: normalizeCollectionStatusForForm(entry.status),
    collectionSource: normalizeCollectionSourceForForm(entry.collectionSource),
    remarks: entry.remarks,
  };
}

function CollectionDetailsTable({
  entries,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  entries: LeadCollectionEntry[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (entry: LeadCollectionEntry) => void;
  onDelete: (entryId: string) => void | Promise<void>;
}) {
  const showActions = canEdit || canDelete;

  return (
    <HeavyNavTableSection
      title="Collection Details"
      isEmpty={entries.length === 0}
      emptyMessage="No collection records yet."
    >
      <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
        <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
          <TableHead className={sectionHeadClassName()}>Till Date Amount</TableHead>
          <TableHead className={sectionHeadClassName()}>Collected</TableHead>
          <TableHead className={sectionHeadClassName()}>Penalty</TableHead>
          <TableHead className={sectionHeadClassName()}>Mode</TableHead>
          <TableHead className={sectionHeadClassName()}>UTR</TableHead>
          <TableHead className={sectionHeadClassName()}>Date & Time</TableHead>
          <TableHead className={sectionHeadClassName()}>Status</TableHead>
          <TableHead className={sectionHeadClassName()}>Source</TableHead>
          <TableHead className={sectionHeadClassName()}>Remarks</TableHead>
          {showActions ? (
            <TableHead className={sectionHeadClassName('text-center')}>Action</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
            <TableCell className={sectionCellClassName}>{entry.tillDateAmount}</TableCell>
            <TableCell className={sectionCellClassName}>{entry.collectedAmount}</TableCell>
            <TableCell className={sectionCellClassName}>{entry.penaltyAmount || '—'}</TableCell>
            <TableCell className={sectionCellClassName}>{entry.collectionMode}</TableCell>
            <TableCell className={sectionCellClassName}>{entry.utrNumber || '—'}</TableCell>
            <TableCell className={cn(sectionCellClassName, 'whitespace-nowrap')}>
              {formatAppDateTimeOrFallback(entry.collectionDateTime)}
            </TableCell>
            <TableCell className={sectionCellClassName}>{entry.status}</TableCell>
            <TableCell className={sectionCellClassName}>{entry.collectionSource}</TableCell>
            <TableCell
              className={cn(sectionCellClassName, 'max-w-[180px] truncate')}
              title={entry.remarks}
            >
              {entry.remarks || '—'}
            </TableCell>
            {showActions ? (
              <TableCell>
                <EditDeleteActions
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry.id)}
                  deleteTitle="Delete this collection?"
                  deleteDescription="This collection record will be permanently removed."
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </HeavyNavTableSection>
  );
}

function RemarkDetailsTable({
  entries,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  entries: LeadRemarkEntry[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (entry: LeadRemarkEntry) => void;
  onDelete: (entryId: string) => void | Promise<void>;
}) {
  const showActions = canEdit || canDelete;

  return (
    <HeavyNavTableSection
      title="Remark Details"
      isEmpty={entries.length === 0}
      emptyMessage="No remarks recorded yet."
    >
      <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
        <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
          <TableHead className={sectionHeadClassName()}>Category</TableHead>
          <TableHead className={sectionHeadClassName()}>Follow Up Date</TableHead>
          <TableHead className={sectionHeadClassName()}>Priority</TableHead>
          <TableHead className={sectionHeadClassName()}>Notes</TableHead>
          <TableHead className={sectionHeadClassName()}>Recorded On</TableHead>
          {showActions ? (
            <TableHead className={sectionHeadClassName('text-center')}>Action</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
            <TableCell className={sectionCellClassName}>{entry.remarkCategory}</TableCell>
            <TableCell className={sectionCellClassName}>
              {formatAppDateOrFallback(entry.followUpDate)}
            </TableCell>
            <TableCell className={sectionCellClassName}>
              <Badge className={remarkPriorityBadgeClass(entry.priority)}>
                {entry.priority || '—'}
              </Badge>
            </TableCell>
            <TableCell className={sectionCellClassName}>{entry.notes}</TableCell>
            <TableCell className={cn(sectionCellClassName, 'whitespace-nowrap')}>
              {formatAppDateTimeOrFallback(entry.recordedOn)}
            </TableCell>
            {showActions ? (
              <TableCell>
                <EditDeleteActions
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry.id)}
                  deleteTitle="Delete this remark?"
                  deleteDescription="This follow-up remark will be permanently removed."
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </HeavyNavTableSection>
  );
}

export function LeadCollectionTabContent({
  leadId,
  defaultTillDateAmount,
  canEdit = false,
  canDelete = false,
  canRemarkEdit = false,
  canRemarkDelete = false,
  onCollectionSaved,
}: LeadCollectionTabContentProps) {
  const [accordionValue, setAccordionValue] = useState('');
  const [collections, setCollections] = useState<LeadCollectionEntry[]>([]);
  const [remarks, setRemarks] = useState<LeadRemarkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [collectionForm, setCollectionForm] = useState(() => emptyCollectionForm(defaultTillDateAmount));
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [collectionFormError, setCollectionFormError] = useState<string | null>(null);
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  const [remarkForm, setRemarkForm] = useState(emptyRemarkForm);
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [remarkFormError, setRemarkFormError] = useState<string | null>(null);
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);
  const [repayDate, setRepayDate] = useState<string>('');

  const collectionStatusOptions = useMemo(
    () => collectionStatusOptionsForRepayDate(collectionForm.collectionDateTime, repayDate),
    [collectionForm.collectionDateTime, repayDate],
  );

  const loadData = useCallback(async () => {
    if (!leadId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [collectionRows, remarkRows] = await Promise.all([
        fetchLeadCollections(leadId).catch(() => []),
        fetchLeadFollowUpRemarks(leadId).catch(() => []),
      ]);
      setCollections(collectionRows.map(mapCollectionFromApi));
      setRemarks(remarkRows.map(mapFollowUpRemarkFromApi));
    } catch {
      toast({ title: 'Failed to load collection data', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!leadId) return;
    fetchLeadDisbursal(leadId)
      .then((response) => {
        const tillDateAmount = response.loan_summary?.till_date_amount;
        const repay = response.disbursal?.repay_date ?? '';
        setRepayDate(repay);
        if (tillDateAmount) {
          setCollectionForm((prev) => ({
            ...prev,
            tillDateAmount: prev.tillDateAmount || tillDateAmount,
          }));
        }
      })
      .catch(() => undefined);
  }, [leadId, defaultTillDateAmount]);

  useEffect(() => {
    if (!collectionForm.status) return;
    if (
      !isCollectionStatusAllowedForRepayDate(
        collectionForm.status,
        collectionForm.collectionDateTime,
        repayDate,
      )
    ) {
      setCollectionForm((prev) => ({ ...prev, status: '' }));
    }
  }, [collectionForm.collectionDateTime, collectionForm.status, repayDate]);

  const handleCollectionSubmit = async () => {
    if (!collectionForm.collectedAmount.trim()) {
      setCollectionFormError('Collected amount is required.');
      return;
    }
    if (!collectionForm.collectionDateTime) {
      setCollectionFormError('Collection date and time is required.');
      return;
    }
    const collectionDateTimeError = validateDateTimeLocalNotAfterNow(collectionForm.collectionDateTime);
    if (collectionDateTimeError) {
      setCollectionFormError(collectionDateTimeError);
      return;
    }
    if (!collectionForm.utrNumber.trim()) {
      setCollectionFormError('UTR number is required.');
      return;
    }
    if (!collectionForm.collectionMode) {
      setCollectionFormError('Please select collection mode.');
      return;
    }
    if (!collectionForm.status) {
      setCollectionFormError('Please select status.');
      return;
    }
    if (
      !isCollectionStatusAllowedForRepayDate(
        collectionForm.status,
        collectionForm.collectionDateTime,
        repayDate,
      )
    ) {
      setCollectionFormError(
        repayDate && collectionForm.collectionDateTime.slice(0, 10) < repayDate.slice(0, 10)
          ? 'Before repay date, only Part Payment or Payday Pre-Close is allowed.'
          : 'On or after repay date, only Close, Settlement, or Part Payment is allowed.',
      );
      return;
    }
    if (!collectionForm.collectionSource) {
      setCollectionFormError('Please select collection source.');
      return;
    }

    const collectionDateTime = fromDateTimeLocalInputValue(collectionForm.collectionDateTime);
    const payload = {
      tillDateAmount: collectionForm.tillDateAmount.trim(),
      collectedAmount: collectionForm.collectedAmount.trim(),
      penaltyAmount: collectionForm.penaltyAmount.trim(),
      collectionMode: collectionForm.collectionMode,
      utrNumber: collectionForm.utrNumber.trim(),
      collectionDateTime,
      waveOff: collectionForm.waveOff.trim(),
      settlementAmount: collectionForm.settlementAmount.trim(),
      status: collectionForm.status,
      collectionSource: collectionForm.collectionSource,
      remarks: collectionForm.remarks.trim(),
    };

    setIsSubmittingCollection(true);
    setCollectionFormError(null);
    const wasEditing = Boolean(editingCollectionId);
    try {
      const response = editingCollectionId
        ? await updateLeadCollection(leadId, editingCollectionId, payload)
        : await createLeadCollection(leadId, payload);
      const mapped = mapCollectionFromApi(response.collection);
      setCollections((prev) =>
        editingCollectionId
          ? prev.map((entry) => (entry.id === editingCollectionId ? mapped : entry))
          : [mapped, ...prev],
      );
      onCollectionSaved?.(response.lead_status_display, response.lead_status);
      setCollectionForm(emptyCollectionForm(defaultTillDateAmount));
      setEditingCollectionId(null);
      // Keep accordion open so the new/updated row stays visible in the table below.
      setAccordionValue('collection_item');
      toast({
        title: wasEditing ? 'Collection updated' : 'Collection recorded',
        variant: 'success',
      });
    } catch (error) {
      setCollectionFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  const handleCollectionCancel = () => {
    setCollectionForm(emptyCollectionForm(defaultTillDateAmount));
    setEditingCollectionId(null);
    setCollectionFormError(null);
    setAccordionValue('');
  };

  const handleEditCollection = (entry: LeadCollectionEntry) => {
    setEditingCollectionId(entry.id);
    setCollectionFormError(null);
    setCollectionForm(collectionEntryToForm(entry));
    setAccordionValue('collection_item');
  };

  const handleDeleteCollection = async (entryId: string) => {
    try {
      const response = await deleteLeadCollection(leadId, entryId);
      setCollections((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingCollectionId === entryId) {
        setCollectionForm(emptyCollectionForm(defaultTillDateAmount));
        setEditingCollectionId(null);
        setAccordionValue('');
      }
      onCollectionSaved?.(response.lead_status_display, response.lead_status);
      toast({ title: 'Collection deleted', variant: 'success' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error), variant: 'error' });
    }
  };

  const handleRemarkSubmit = async () => {
    if (!remarkForm.remarkCategory) {
      setRemarkFormError('Please select remark category.');
      return;
    }
    if (!remarkForm.priority) {
      setRemarkFormError('Please select priority.');
      return;
    }
    if (!remarkForm.notes.trim()) {
      setRemarkFormError('Remarks are required.');
      return;
    }

    setIsSubmittingRemark(true);
    setRemarkFormError(null);
    const wasEditing = Boolean(editingRemarkId);
    const payload = {
      remarkCategory: remarkForm.remarkCategory,
      followUpDate: remarkForm.followUpDate,
      priority: remarkForm.priority,
      notes: remarkForm.notes.trim(),
    };
    try {
      const record = editingRemarkId
        ? await updateLeadFollowUpRemark(leadId, editingRemarkId, payload)
        : await createLeadFollowUpRemark(leadId, payload);
      const mapped = mapFollowUpRemarkFromApi(record);
      setRemarks((prev) =>
        editingRemarkId
          ? prev.map((entry) => (entry.id === editingRemarkId ? mapped : entry))
          : [mapped, ...prev],
      );
      setRemarkForm(emptyRemarkForm());
      setEditingRemarkId(null);
      setAccordionValue('');
      toast({
        title: wasEditing ? 'Remark updated' : 'Remark saved',
        variant: 'success',
      });
    } catch (error) {
      setRemarkFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  const handleRemarkCancel = () => {
    setRemarkForm(emptyRemarkForm());
    setEditingRemarkId(null);
    setRemarkFormError(null);
    setAccordionValue('');
  };

  const handleEditRemark = (entry: LeadRemarkEntry) => {
    setEditingRemarkId(entry.id);
    setRemarkFormError(null);
    setRemarkForm(remarkEntryToForm(entry));
    setAccordionValue('remarks_item');
  };

  const handleDeleteRemark = async (entryId: string) => {
    try {
      await deleteLeadFollowUpRemark(leadId, entryId);
      setRemarks((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingRemarkId === entryId) {
        setRemarkForm(emptyRemarkForm());
        setEditingRemarkId(null);
        setAccordionValue('');
      }
      toast({ title: 'Remark deleted', variant: 'success' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error), variant: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      {isLoading ? (
        <LoadingState layout="section" message="Loading collection details…" size="sm" />
      ) : (
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={setAccordionValue}
        className="space-y-4"
      >
        <AccordionItem
          value="collection_item"
          className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm"
        >
          <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center shrink-0">
                <CreditCard size={15} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                {editingCollectionId ? 'Edit Collection' : 'Add Collection'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 space-y-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Record repayment collection against this loan.
            </p>
            <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FormFieldLabel>Till Date Amount</FormFieldLabel>
                  <Input
                    type="number"
                    value={collectionForm.tillDateAmount}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, tillDateAmount: e.target.value }))}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Collected Amount</FormFieldLabel>
                  <Input
                    type="number"
                    value={collectionForm.collectedAmount}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, collectedAmount: e.target.value }))}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Collection Date & Time</FormFieldLabel>
                  <Input
                    key={`collection-datetime-${editingCollectionId ?? 'new'}`}
                    type="datetime-local"
                    value={collectionForm.collectionDateTime}
                    max={currentDateTimeLocalInputValue()}
                    onChange={(e) =>
                      setCollectionForm((prev) => ({ ...prev, collectionDateTime: e.target.value }))
                    }
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel>Penalty Amount</FormFieldLabel>
                  <Input
                    type="number"
                    value={collectionForm.penaltyAmount}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, penaltyAmount: e.target.value }))}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Collection Mode</FormFieldLabel>
                  <FormSelect
                    key={`collection-mode-${editingCollectionId ?? 'new'}`}
                    value={collectionForm.collectionMode}
                    onChange={(collectionMode) =>
                      setCollectionForm((prev) => ({ ...prev, collectionMode }))
                    }
                    placeholder={selectPlaceholder('Collection Mode')}
                    options={COLLECTION_MODE_OPTIONS}
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>UTR Number</FormFieldLabel>
                  <Input
                    value={collectionForm.utrNumber}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, utrNumber: e.target.value }))}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Status</FormFieldLabel>
                  <FormSelect
                    key={`collection-status-${editingCollectionId ?? 'new'}-${collectionStatusOptions.join('-')}`}
                    value={collectionForm.status}
                    onChange={(status) => setCollectionForm((prev) => ({ ...prev, status }))}
                    placeholder={selectPlaceholder('Status')}
                    options={collectionStatusOptions}
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel>Wave Off</FormFieldLabel>
                  <Input
                    type="number"
                    value={collectionForm.waveOff}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, waveOff: e.target.value }))}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel>Settlement Amount</FormFieldLabel>
                  <Input
                    type="number"
                    value={collectionForm.settlementAmount}
                    onChange={(e) =>
                      setCollectionForm((prev) => ({ ...prev, settlementAmount: e.target.value }))
                    }
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Collection Source</FormFieldLabel>
                  <FormSelect
                    key={`collection-source-${editingCollectionId ?? 'new'}`}
                    value={collectionForm.collectionSource}
                    onChange={(collectionSource) =>
                      setCollectionForm((prev) => ({ ...prev, collectionSource }))
                    }
                    placeholder={selectPlaceholder('Collection Source')}
                    options={COLLECTION_SOURCE_OPTIONS}
                  />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <FormFieldLabel>Remarks</FormFieldLabel>
                  <textarea
                    value={collectionForm.remarks}
                    onChange={(e) => setCollectionForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    className={textareaClassName}
                  />
                </div>
              </div>

              {collectionFormError && (
                <p className="text-[11px] font-semibold text-rose-600">{collectionFormError}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-4"
                  onClick={handleCollectionSubmit}
                  disabled={isSubmittingCollection}
                >
                  <Plus size={14} className="mr-1.5" />
                  {editingCollectionId ? 'Update Collection' : 'Add Collection'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
                  onClick={handleCollectionCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>

            <CollectionDetailsTable
              entries={collections}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={handleEditCollection}
              onDelete={handleDeleteCollection}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="remarks_item"
          className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm"
        >
          <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center shrink-0">
                <MessageSquare size={15} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                {editingRemarkId ? 'Edit Remark' : 'Add Remarks'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 space-y-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Add follow-up remarks for this loan account.
            </p>
            <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FormFieldLabel required>Remark Category</FormFieldLabel>
                  <FormSelect
                    key={`remark-category-${editingRemarkId ?? 'new'}`}
                    value={remarkForm.remarkCategory}
                    onChange={(remarkCategory) =>
                      setRemarkForm((prev) => ({ ...prev, remarkCategory }))
                    }
                    placeholder={selectPlaceholder('Remark Category')}
                    options={REMARK_CATEGORY_OPTIONS}
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel>Follow Up Date</FormFieldLabel>
                  <DatePicker
                    key={`remark-date-${editingRemarkId ?? 'new'}`}
                    value={remarkForm.followUpDate}
                    onChange={(followUpDate) =>
                      setRemarkForm((prev) => ({ ...prev, followUpDate }))
                    }
                    placeholder={selectPlaceholder('Follow Up Date')}
                    size="sm"
                    toYear={new Date().getFullYear() + 5}
                  />
                </div>
                <div className="space-y-1">
                  <FormFieldLabel required>Priority</FormFieldLabel>
                  <FormSelect
                    key={`remark-priority-${editingRemarkId ?? 'new'}`}
                    value={remarkForm.priority}
                    onChange={(priority) =>
                      setRemarkForm((prev) => ({ ...prev, priority }))
                    }
                    placeholder={selectPlaceholder('Priority')}
                    options={REMARK_PRIORITY_OPTIONS}
                  />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <FormFieldLabel required>Remarks</FormFieldLabel>
                  <textarea
                    value={remarkForm.notes}
                    onChange={(e) => setRemarkForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className={textareaClassName}
                  />
                </div>
              </div>

              {remarkFormError && (
                <p className="text-[11px] font-semibold text-rose-600">{remarkFormError}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-4"
                  onClick={handleRemarkSubmit}
                  disabled={isSubmittingRemark}
                >
                  {editingRemarkId ? 'Update Remark' : 'Save Remark'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
                  onClick={handleRemarkCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>

            <RemarkDetailsTable
              entries={remarks}
              canEdit={canRemarkEdit}
              canDelete={canRemarkDelete}
              onEdit={handleEditRemark}
              onDelete={handleDeleteRemark}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      )}
    </div>
  );
}
