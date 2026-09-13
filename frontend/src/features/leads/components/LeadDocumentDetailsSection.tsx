import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, EyeOff, Minus, PenLine, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RowDeleteButton,
  RowViewButton,
} from '@/components/ui/data-table-row-action-buttons';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import { entryStatusBadgeClass } from '@/lib/badgeStyles';
import { ROW_ACTION_ICON_CLASS, ROW_EDIT_ICON_BUTTON_CLASS, ROW_EDIT_ICON_CLASS } from '@/lib/uiTokens';
import { cn } from '@/lib/utils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteLeadDocument,
  downloadAuthenticatedFile,
  fetchLeadDocuments,
  getLeadDocumentDownloadUrl,
  mapDocumentTypeFromApi,
  updateLeadDocument,
  uploadLeadDocument,
  type ApiLeadDocument,
} from '@/lib/leadDetailsApi';
import { leadDocumentViewPath } from '@/lib/leadNavigation';
import {
  FORM_TRANSITION_MS,
  FormFieldLabel,
  FormSelect,
  STATUS_OPTIONS,
  entryStatusLabel,
  sectionCellClassName,
} from '@/features/leads/components/leadDetailSectionShared';

export const LEAD_DOCUMENT_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Cibil Report',
  'Bank Statement',
  'Selfie',
  'Salary Slip',
  'ID Card',
  'Cheque',
  'Electricity Bill',
  'Mobile Bill',
  'Others',
] as const;

export type LeadDocumentType = (typeof LEAD_DOCUMENT_TYPES)[number];

export type LeadDocumentStatus = 'verified' | 'unverified' | 'incomplete';

const DEFAULT_DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const OTHERS_DOCUMENT_ACCEPT = `${DEFAULT_DOCUMENT_ACCEPT},.zip`;

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
const OTHERS_ALLOWED_EXTENSIONS = new Set([...ALLOWED_DOCUMENT_EXTENSIONS, 'zip']);

function getDocumentAccept(documentType: LeadDocumentType): string {
  return documentType === 'Others' ? OTHERS_DOCUMENT_ACCEPT : DEFAULT_DOCUMENT_ACCEPT;
}

function getAllowedExtensions(documentType: LeadDocumentType): Set<string> {
  return documentType === 'Others' ? OTHERS_ALLOWED_EXTENSIONS : ALLOWED_DOCUMENT_EXTENSIONS;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
]);

function isZipFile(file: File): boolean {
  if (getFileExtension(file.name) === 'zip') return true;
  return ZIP_MIME_TYPES.has(file.type);
}

function isAllowedDocumentFile(file: File, documentType: LeadDocumentType): boolean {
  const allowed = getAllowedExtensions(documentType);
  if (allowed.has(getFileExtension(file.name))) return true;
  return documentType === 'Others' && isZipFile(file);
}

export interface LeadDocumentEntry {
  id: string;
  documentType: LeadDocumentType;
  fileName: string;
  fileUrl: string;
  password: string;
  status: LeadDocumentStatus;
}

interface LeadDocumentDetailsSectionProps {
  leadId: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canView?: boolean;
  canDownload?: boolean;
  canDelete?: boolean;
  /** Called when a verified document may have advanced application status (e.g. documents pending → verified). */
  onApplicationStatusChange?: () => void | Promise<void>;
}

interface DocumentFormRow {
  id: string;
  documentType: LeadDocumentType | '';
  file: File | null;
  password: string;
  status: LeadDocumentStatus | '';
}

function createFormRow(): DocumentFormRow {
  return {
    id: crypto.randomUUID(),
    documentType: '',
    file: null,
    password: '',
    status: '',
  };
}

const MASKED_PASSWORD = 'xxxxxxxx';

function DocumentPasswordCell({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  const trimmed = password?.trim();
  if (!trimmed) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
        {visible ? trimmed : MASKED_PASSWORD}
      </span>
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-primary-deep focus:outline-none dark:hover:text-slate-200"
        title={visible ? 'Hide password' : 'Show password'}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function DocumentPasswordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        placeholder={enterPlaceholder('Password')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pr-8 text-[11px]"
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep focus:outline-none dark:hover:text-slate-200"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function getReplaceDocumentDialogDescription(
  fileName: string,
  hadExistingPassword: boolean,
): string {
  if (hadExistingPassword) {
    return `Re-uploading "${fileName}" will replace the file. Leave the password blank if the new file is not protected, or enter a new password to replace the saved one.`;
  }
  return `Re-uploading "${fileName}". Leave the password blank if the new file is not protected, or enter one if it is.`;
}

function mapApiDocument(doc: ApiLeadDocument): LeadDocumentEntry {
  return {
    id: doc.id,
    documentType: mapDocumentTypeFromApi(doc.document_type) as LeadDocumentType,
    fileName: doc.file_name,
    fileUrl: doc.file_url ?? '',
    password: doc.password ?? '',
    status: doc.status,
  };
}

export function LeadDocumentDetailsSection({
  leadId,
  canAdd = false,
  canEdit = false,
  canView = false,
  canDownload = false,
  canDelete = false,
  onApplicationStatusChange,
}: LeadDocumentDetailsSectionProps) {
  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 5 : 4;
  const [documents, setDocuments] = useState<LeadDocumentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<{ id: string; fileName: string } | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{
    id: string;
    file: File;
    documentType: LeadDocumentType;
    fileName: string;
    password: string;
    hadExistingPassword: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formRows, setFormRows] = useState<DocumentFormRow[]>([createFormRow()]);
  const [formError, setFormError] = useState<string | null>(null);
  const resetFormTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetFormTimeoutRef.current !== null) {
        window.clearTimeout(resetFormTimeoutRef.current);
      }
    };
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadDocuments(leadId);
      setDocuments(data.map(mapApiDocument));
    } catch (err) {
      toast({
        title: 'Failed to load documents',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const resetForm = useCallback(() => {
    setFormRows([createFormRow()]);
    setFormError(null);
  }, []);

  const openUploadForm = () => {
    if (resetFormTimeoutRef.current !== null) {
      window.clearTimeout(resetFormTimeoutRef.current);
      resetFormTimeoutRef.current = null;
    }
    resetForm();
    setShowUploadForm(true);
  };

  const closeUploadForm = useCallback(() => {
    setShowUploadForm(false);
    if (resetFormTimeoutRef.current !== null) {
      window.clearTimeout(resetFormTimeoutRef.current);
    }
    resetFormTimeoutRef.current = window.setTimeout(() => {
      resetForm();
      resetFormTimeoutRef.current = null;
    }, FORM_TRANSITION_MS);
  }, [resetForm]);

  const updateFormRow = (rowId: string, patch: Partial<DocumentFormRow>) => {
    setFormRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addFormRow = () => {
    setFormRows((prev) => [...prev, createFormRow()]);
  };

  const removeFormRow = (rowId: string) => {
    setFormRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleSubmitForm = async () => {
    const missingTypeRow = formRows.find((row) => !row.documentType);
    if (missingTypeRow) {
      setFormError('Please select document type for every row before uploading.');
      return;
    }
    const missingFileRow = formRows.find((row) => !row.file);
    if (missingFileRow) {
      setFormError('Please select a file for every document row before uploading.');
      return;
    }
    const missingStatusRow = formRows.find((row) => !row.status);
    if (missingStatusRow) {
      setFormError('Please select status for every document row before uploading.');
      return;
    }

    const invalidTypeRow = formRows.find(
      (row) => row.file && row.documentType && !isAllowedDocumentFile(row.file, row.documentType),
    );
    if (invalidTypeRow) {
      setFormError(
        invalidTypeRow.documentType === 'Others'
          ? 'For "Others", upload PDF, image, or ZIP files only.'
          : 'Only PDF and image files are allowed for this document type.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.all(
        formRows.map((row) =>
          uploadLeadDocument(leadId, {
            documentType: row.documentType as LeadDocumentType,
            file: row.file!,
            password: row.password.trim(),
            status: row.status as LeadDocumentStatus,
          }),
        ),
      );
      await loadDocuments();
      closeUploadForm();
      await onApplicationStatusChange?.();
      toast({ title: 'Documents uploaded', variant: 'success' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLeadDocument(leadId, deleteTarget.id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: 'Document deleted', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const performDocumentReplace = useCallback(
    async (entryId: string, file: File, password: string) => {
      setIsReplacing(true);
      try {
        const updated = await updateLeadDocument(leadId, entryId, {
          file,
          password: password.trim(),
        });
        const mapped = mapApiDocument(updated);
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === entryId ? mapped : doc)),
        );
        if (mapped.status === 'verified') {
          await onApplicationStatusChange?.();
        }
        toast({ title: 'Document updated', variant: 'success' });
        setReplaceTarget(null);
      } catch (err) {
        toast({
          title: 'Update failed',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'error',
        });
      } finally {
        setIsReplacing(false);
      }
    },
    [leadId, onApplicationStatusChange],
  );

  const handleReplaceFile = (
    entryId: string,
    file: File | undefined,
    documentType: LeadDocumentType,
    currentFileName: string,
    currentPassword: string,
  ) => {
    if (!file) return;
    if (!isAllowedDocumentFile(file, documentType)) {
      toast({
        title: 'Invalid file type',
        description:
          documentType === 'Others'
            ? 'For "Others", upload PDF, image, or ZIP files only.'
            : 'Only PDF and image files are allowed for this document type.',
        variant: 'error',
      });
      return;
    }

    const hadExistingPassword = Boolean(currentPassword?.trim());
    setReplaceTarget({
      id: entryId,
      file,
      documentType,
      fileName: currentFileName,
      password: '',
      hadExistingPassword,
    });
  };

  const handleConfirmReplace = async () => {
    if (!replaceTarget) return;
    await performDocumentReplace(
      replaceTarget.id,
      replaceTarget.file,
      replaceTarget.password,
    );
  };

  const requestVerifyDocument = (entry: LeadDocumentEntry) => {
    if (entry.status === 'verified' || !canEdit) return;
    setVerifyTarget({ id: entry.id, fileName: entry.fileName });
  };

  const handleConfirmVerify = async () => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      const updated = await updateLeadDocument(leadId, verifyTarget.id, { status: 'verified' });
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === verifyTarget.id ? mapApiDocument(updated) : doc)),
      );
      await onApplicationStatusChange?.();
      toast({
        title: 'Document verified',
        description: `"${verifyTarget.fileName}" has been marked as verified.`,
        variant: 'success',
      });
      setVerifyTarget(null);
    } catch (err) {
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete this document?"
        description={
          deleteTarget
            ? `"${deleteTarget.fileName}" will be permanently removed from this lead. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Document"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
      <AlertDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isVerifying) setVerifyTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {verifyTarget
                ? `"${verifyTarget.fileName}" will be marked as verified. This cannot be undone.`
                : 'Mark document as verified'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {verifyTarget
                ? `Are you sure you want to mark "${verifyTarget.fileName}" as verified? This action is permanent and cannot be reversed.`
                : 'This action is permanent and cannot be reversed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isVerifying} onClick={handleConfirmVerify}>
              {isVerifying ? 'Verifying...' : 'Mark Verified'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={replaceTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isReplacing) setReplaceTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace document?</AlertDialogTitle>
            <AlertDialogDescription>
              {replaceTarget
                ? getReplaceDocumentDialogDescription(
                    replaceTarget.fileName,
                    replaceTarget.hadExistingPassword,
                  )
                : 'Confirm the new file and password before replacing.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {replaceTarget && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                New password (optional)
              </label>
              <DocumentPasswordInput
                value={replaceTarget.password}
                onChange={(password) =>
                  setReplaceTarget((prev) => (prev ? { ...prev, password } : prev))
                }
              />
              <p className="text-[10px] text-slate-400">
                New file: {replaceTarget.file.name}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReplacing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isReplacing} onClick={handleConfirmReplace}>
              {isReplacing ? 'Uploading...' : 'Replace Document'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Upload and manage KYC documents for this lead.
        </p>
        <div
          className={cn(
            'overflow-hidden shrink-0 transition-all ease-out',
            !canAdd || showUploadForm
              ? 'max-w-0 opacity-0 scale-95 pointer-events-none duration-200'
              : 'max-w-[140px] opacity-100 scale-100 duration-300 delay-75',
          )}
        >
          <Button
            size="sm"
            className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-3 whitespace-nowrap"
            onClick={openUploadForm}
          >
            <Upload size={14} className="mr-1.5" />
            Upload
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity,margin-top] ease-in-out',
          showUploadForm
            ? 'grid-rows-[1fr] opacity-100 duration-300'
            : 'grid-rows-[0fr] opacity-0 duration-300',
        )}
        aria-hidden={!showUploadForm}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={cn(
              'rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-3 origin-top transition-[transform,opacity] ease-out',
              showUploadForm
                ? 'translate-y-0 opacity-100 duration-300 delay-75'
                : '-translate-y-2 opacity-0 duration-200 pointer-events-none',
            )}
          >
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Add Documents
          </p>

          <div className="space-y-2">
            {formRows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 md:grid-cols-[minmax(140px,1fr)_minmax(160px,1.2fr)_minmax(100px,0.7fr)_minmax(100px,0.7fr)_auto] gap-2 items-end"
              >
                <div className="space-y-1">
                  {index === 0 && (
                    <FormFieldLabel required>Document Type</FormFieldLabel>
                  )}
                  <FormSelect
                    value={row.documentType}
                    onChange={(documentType) => {
                      const nextType = documentType as LeadDocumentType | '';
                      const patch: Partial<DocumentFormRow> = { documentType: nextType };
                      if (nextType && row.file && !isAllowedDocumentFile(row.file, nextType)) {
                        patch.file = null;
                        setFormError('ZIP files are only allowed when document type is "Others".');
                      } else {
                        setFormError(null);
                      }
                      updateFormRow(row.id, patch);
                    }}
                    placeholder={selectPlaceholder('Document Type')}
                    options={LEAD_DOCUMENT_TYPES}
                  />
                </div>

                <div className="space-y-1">
                  {index === 0 && (
                    <FormFieldLabel required>File</FormFieldLabel>
                  )}
                  <Input
                    type="file"
                    accept={row.documentType ? getDocumentAccept(row.documentType) : DEFAULT_DOCUMENT_ACCEPT}
                    className="h-8 text-[11px] file:text-[10px] file:font-semibold"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && row.documentType && !isAllowedDocumentFile(file, row.documentType)) {
                        setFormError(
                          row.documentType === 'Others'
                            ? 'For "Others", upload PDF, image, or ZIP files only.'
                            : 'Only PDF and image files are allowed for this document type.',
                        );
                        e.target.value = '';
                        return;
                      }
                      updateFormRow(row.id, { file });
                      setFormError(null);
                    }}
                  />
                </div>

                <div className="space-y-1">
                  {index === 0 && (
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Password
                    </label>
                  )}
                  <DocumentPasswordInput
                    value={row.password}
                    onChange={(password) => updateFormRow(row.id, { password })}
                  />
                </div>

                <div className="space-y-1">
                  {index === 0 && (
                    <FormFieldLabel required>Status</FormFieldLabel>
                  )}
                  <FormSelect
                    value={row.status}
                    onChange={(status) =>
                      updateFormRow(row.id, { status: status as LeadDocumentStatus | '' })
                    }
                    placeholder={selectPlaceholder('Status')}
                    options={STATUS_OPTIONS.map((status) => ({
                      value: status,
                      label: entryStatusLabel(status),
                    }))}
                  />
                </div>

                <div className={cn('flex items-center gap-1', index === 0 && 'pb-0.5')}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-slate-200"
                    title="Add row"
                    onClick={addFormRow}
                  >
                    <Plus size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-slate-200"
                    title="Remove row"
                    disabled={formRows.length <= 1}
                    onClick={() => removeFormRow(row.id)}
                  >
                    <Minus size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {formError && (
            <p className="text-[11px] font-semibold text-rose-600">{formError}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-4"
              onClick={handleSubmitForm}
              disabled={isSubmitting}
            >
              <Upload size={14} className="mr-1.5" />
              Upload Documents
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
              onClick={closeUploadForm}
            >
              Cancel
            </Button>
          </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800 transition-[margin-top] duration-300 ease-in-out">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Document Type
              </TableHead>
              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Document
              </TableHead>
              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Password
              </TableHead>
              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Status
              </TableHead>
              {showActionColumn && (
              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap text-center">
                Action
              </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingRow colSpan={tableColSpan} message="Loading documents…" compact />
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="h-24 text-center">
                  <p className="text-[11px] text-slate-400 font-medium italic">
                    No documents uploaded yet. Click Upload to add documents.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="border-b border-slate-50 dark:border-slate-850"
                >
                  <TableCell className={sectionCellClassName}>
                    {entry.documentType}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canView && entry.documentType !== 'Others' && (
                        <RowViewButton
                          title="View"
                          aria-label="View document"
                          disabled={!entry.fileName}
                          to={leadDocumentViewPath(leadId, entry.id)}
                          newTab
                        />
                      )}
                      {canDownload && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] font-bold rounded-md"
                          onClick={async () => {
                            try {
                              await downloadAuthenticatedFile(
                                getLeadDocumentDownloadUrl(leadId, entry.id),
                                entry.fileName,
                              );
                            } catch (err) {
                              toast({
                                title: 'Download failed',
                                description: err instanceof Error ? err.message : 'Please try again.',
                                variant: 'error',
                              });
                            }
                          }}
                        >
                          <Download size={12} className="mr-1" />
                          Download
                        </Button>
                      )}
                      {!canView && !canDownload && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {entry.fileName || '—'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={sectionCellClassName}>
                    <DocumentPasswordCell password={entry.password} />
                  </TableCell>
                  <TableCell>
                    {entry.status === 'verified' || !canEdit ? (
                      <Badge className={entryStatusBadgeClass(entry.status)}>
                        {entryStatusLabel(entry.status)}
                      </Badge>
                    ) : (
                      <button type="button" onClick={() => requestVerifyDocument(entry)}>
                        <Badge
                          className={entryStatusBadgeClass(entry.status, 'cursor-pointer')}
                        >
                          {entryStatusLabel(entry.status)}
                        </Badge>
                      </button>
                    )}
                  </TableCell>
                  {showActionColumn && (
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {canEdit && (
                      <label
                        title="Replace file"
                        className={cn(
                          'inline-flex cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent',
                          ROW_EDIT_ICON_BUTTON_CLASS,
                        )}
                      >
                        <PenLine className={cn(ROW_ACTION_ICON_CLASS, ROW_EDIT_ICON_CLASS)} />
                        <input
                          type="file"
                          accept={getDocumentAccept(entry.documentType)}
                          className="hidden"
                          onChange={(e) => {
                            handleReplaceFile(
                              entry.id,
                              e.target.files?.[0],
                              entry.documentType,
                              entry.fileName,
                              entry.password,
                            );
                            e.target.value = '';
                          }}
                        />
                      </label>
                      )}
                      {canDelete && (
                      <RowDeleteButton
                        title="Delete"
                        aria-label="Delete document"
                        onClick={() => setDeleteTarget({ id: entry.id, fileName: entry.fileName })}
                      />
                      )}
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
