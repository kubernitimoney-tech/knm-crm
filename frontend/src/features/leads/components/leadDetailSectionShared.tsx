import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Plus } from 'lucide-react';
import {
  RowActionButtonGroup,
  RowDeleteButton,
  RowEditButton,
} from '@/components/ui/data-table-row-action-buttons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RequiredMark } from '@/components/ui/field-label';
import { cn } from '@/lib/utils';
import { SURFACE_CARD_CLASS, ROW_ACTION_ICON_CLASS } from '@/lib/uiTokens';
import { dataTableCellClass, dataTableHeadClass } from '@/components/ui/data-table';
import { AppSelect } from '@/components/ui/app-select';
import { entryStatusBadgeClass } from '@/lib/badgeStyles';

export const FORM_TRANSITION_MS = 320;

/** @deprecated Use appSelectTriggerClass from @/components/ui/app-select */
export { appSelectTriggerClass as selectClassName } from '@/components/ui/app-select';

export type FormSelectOption =
  | string
  | {
      value: string;
      label: string;
    };

interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly FormSelectOption[];
  className?: string;
  disabled?: boolean;
  hidePlaceholder?: boolean;
}

export function FormSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  disabled,
  hidePlaceholder = false,
}: FormSelectProps) {
  return (
    <AppSelect
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      options={options}
      triggerClassName={className}
      disabled={disabled}
      hidePlaceholder={hidePlaceholder}
      elevated
    />
  );
}

export const textareaClassName =
  'w-full min-h-[72px] px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-[11px] font-semibold text-slate-600 dark:text-slate-300 outline-none focus-visible:border-primary-deep/40 resize-y';

export const STATUS_OPTIONS = ['verified', 'unverified', 'incomplete'] as const;
export const BINARY_STATUS_OPTIONS = ['verified', 'unverified'] as const;
export type EntryStatus = (typeof STATUS_OPTIONS)[number];
export type BinaryEntryStatus = (typeof BINARY_STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<EntryStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  incomplete: 'Incomplete',
};

export function entryStatusLabel(status: EntryStatus): string {
  return STATUS_LABELS[status];
}

export function binaryStatusOptions() {
  return BINARY_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: entryStatusLabel(status),
  }));
}

export function FormFieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

export function StatusBadge({
  status,
  onClick,
}: {
  status: EntryStatus;
  onClick?: () => void;
}) {
  const badge = (
    <Badge className={cn(onClick && 'cursor-pointer', entryStatusBadgeClass(status))}>
      {STATUS_LABELS[status]}
    </Badge>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick}>
        {badge}
      </button>
    );
  }

  return badge;
}

interface AnimatedAddFormPanelProps {
  showForm: boolean;
  onOpen: () => void;
  onClose: () => void;
  addButtonLabel: string;
  formTitle: string;
  submitLabel: string;
  onSubmit: () => void;
  formError?: string | null;
  description?: string;
  showAddButton?: boolean;
  children: React.ReactNode;
}

export function AnimatedAddFormPanel({
  showForm,
  onOpen,
  onClose,
  addButtonLabel,
  formTitle,
  submitLabel,
  onSubmit,
  formError,
  description,
  showAddButton = true,
  children,
}: AnimatedAddFormPanelProps) {
  return (
    <div className="space-y-4">
      {(description || (!showForm && showAddButton)) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {description}
            </p>
          )}
          {showAddButton && (
          <div
            className={cn(
              'overflow-hidden shrink-0 transition-all ease-out ml-auto',
              showForm
                ? 'max-w-0 opacity-0 scale-95 pointer-events-none duration-200'
                : 'max-w-[180px] opacity-100 scale-100 duration-300 delay-75',
            )}
          >
            <Button
              size="sm"
              className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-3 whitespace-nowrap"
              onClick={onOpen}
            >
              <Plus size={14} className="mr-1.5" />
              {addButtonLabel}
            </Button>
          </div>
          )}
        </div>
      )}

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] ease-in-out',
          showForm ? 'grid-rows-[1fr] opacity-100 duration-300' : 'grid-rows-[0fr] opacity-0 duration-300',
        )}
        aria-hidden={!showForm}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={cn(
              'rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-3 origin-top transition-[transform,opacity] ease-out',
              showForm
                ? 'translate-y-0 opacity-100 duration-300 delay-75'
                : '-translate-y-2 opacity-0 duration-200 pointer-events-none',
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{formTitle}</p>
            {children}
            {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-xs rounded-lg px-4"
                onClick={onSubmit}
              >
                {submitLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
                onClick={onClose}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useAnimatedFormPanel() {
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const openForm = useCallback((onOpen?: () => void) => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    onOpen?.();
    setFormError(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback((onAfterClose?: () => void) => {
    setShowForm(false);
    afterCloseRef.current = onAfterClose ?? null;
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      afterCloseRef.current?.();
      afterCloseRef.current = null;
      resetTimeoutRef.current = null;
    }, FORM_TRANSITION_MS);
  }, []);

  return { showForm, formError, setFormError, openForm, closeForm };
}

export function SectionEditButton({
  onClick,
  title = 'Edit',
}: {
  onClick: () => void;
  title?: string;
}) {
  return <RowEditButton onClick={onClick} title={title} aria-label={title} />;
}

export function SectionMailButton({
  onClick,
  title = 'Send email',
  disabled,
  loading,
}: {
  onClick: () => void | Promise<void>;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      nativeButton
      variant="ghost"
      size="icon"
      className="group/row-action h-8 w-8 text-white hover:bg-white/10 hover:text-white"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void onClick();
      }}
      disabled={disabled || loading}
      title={title}
      aria-label={title}
    >
      {loading ? (
        <Loader2 className={cn(ROW_ACTION_ICON_CLASS, 'text-white animate-spin')} />
      ) : (
        <Mail className={cn(ROW_ACTION_ICON_CLASS, 'text-white')} />
      )}
    </Button>
  );
}

interface EditDeleteActionsProps {
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  deleteTitle?: string;
  deleteDescription?: string;
  deleteConfirmLabel?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function EditDeleteActions({
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  deleteConfirmLabel,
  canEdit = true,
  canDelete = true,
}: EditDeleteActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <RowActionButtonGroup>
        {canEdit && <RowEditButton onClick={onEdit} />}
        {canDelete && <RowDeleteButton onClick={() => setConfirmOpen(true)} />}
      </RowActionButtonGroup>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel={deleteConfirmLabel}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center">
        <p className="text-[11px] text-slate-400 font-medium italic">{message}</p>
      </TableCell>
    </TableRow>
  );
}

export function SectionTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800">
      <Table>
        {children}
      </Table>
    </div>
  );
}

/** Card with primary header bar (same style as sanction / disbursal detail sections). */
export function HeavyNavTableSection({
  title,
  headerAction,
  compact = true,
  isEmpty = false,
  emptyMessage = 'No records yet.',
  children,
}: {
  title: string;
  headerAction?: React.ReactNode;
  compact?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(SURFACE_CARD_CLASS, 'rounded-[14px] overflow-hidden shadow-md shadow-slate-100/50 dark:shadow-none border border-slate-150')}>
      <div
        className={cn(
          'relative flex items-center justify-center bg-primary-deep dark:bg-primary-deep/80',
          compact ? 'py-2 px-3' : 'py-2.5 px-4',
        )}
      >
        <span className="text-white font-bold text-xs uppercase tracking-wider">{title}</span>
        {headerAction ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{headerAction}</div>
        ) : null}
      </div>
      {isEmpty ? (
        <p className="text-[11px] text-slate-400 font-medium italic py-6 px-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>{children}</Table>
        </div>
      )}
    </div>
  );
}

export const sectionCellClassName = dataTableCellClass;

export function sectionHeadClassName(extra?: string) {
  return cn(dataTableHeadClass, 'py-3', extra);
}

export interface GridDetailItem {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

export function GridDetailTable({
  items,
  columnsPerRow = 4,
  compact = false,
  title,
  headerAction,
  headerClassName,
}: {
  items: GridDetailItem[];
  columnsPerRow?: 3 | 4 | 6;
  compact?: boolean;
  title?: string;
  headerAction?: React.ReactNode;
  headerClassName?: string;
}) {
  const gridCols =
    columnsPerRow === 3
      ? 'md:grid-cols-3'
      : columnsPerRow === 6
        ? 'md:grid-cols-3 lg:grid-cols-6'
        : 'md:grid-cols-4';

  return (
    <div className={cn(SURFACE_CARD_CLASS, 'rounded-[14px] overflow-hidden shadow-md shadow-slate-100/50 dark:shadow-none border border-slate-150')}>
      {title && (
        <div
          className={cn(
            'relative flex items-center justify-center',
            compact ? 'py-2 px-3' : 'py-2.5 px-4',
            headerClassName ?? 'bg-primary-deep dark:bg-primary-deep/80',
          )}
        >
          <span className="text-white font-bold text-xs uppercase tracking-wider">{title}</span>
          {headerAction && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">{headerAction}</div>
          )}
        </div>
      )}
      <div className={compact ? 'p-3' : 'p-6'}>
        <div
          className={cn(
            'grid grid-cols-1 text-xs font-sans',
            compact ? 'gap-2' : 'gap-4',
            gridCols,
          )}
        >
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                'border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/25 dark:bg-slate-950/20',
                compact ? 'px-2 py-1.5' : 'p-3',
              )}
            >
              <p
                className={cn(
                  'text-slate-400 dark:text-slate-500 font-bold leading-tight',
                  compact ? 'mb-0.5 text-[10px]' : 'mb-1',
                )}
              >
                {item.label}
              </p>
              <div
                className={cn(
                  'text-slate-800 dark:text-slate-200 font-semibold break-words',
                  compact ? 'text-[11px] leading-snug' : 'leading-normal',
                  item.valueClassName,
                )}
              >
                {item.value == null || item.value === '' ? '—' : item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface HorizontalDetailColumn {
  label: string;
  value: React.ReactNode;
}

export function HorizontalDetailTable({
  columns,
  title,
  headerAction,
  headerClassName,
}: {
  columns: HorizontalDetailColumn[];
  title?: string;
  headerAction?: React.ReactNode;
  headerClassName?: string;
}) {
  return (
    <div className={cn(SURFACE_CARD_CLASS, 'rounded-[14px] overflow-hidden shadow-md shadow-slate-100/50 dark:shadow-none border border-slate-150')}>
      {title && (
        <div
          className={cn(
            'relative py-2.5 px-4 flex items-center justify-center',
            headerClassName ?? 'bg-primary-deep dark:bg-primary-deep/80',
          )}
        >
          <span className="text-white font-bold text-xs uppercase tracking-wider">{title}</span>
          {headerAction && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">{headerAction}</div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
              {columns.map((col) => (
                <TableHead
                  key={col.label}
                  className={cn(dataTableHeadClass, 'whitespace-nowrap text-[10px] px-3 py-2.5')}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.label}
                  className={cn(dataTableCellClass, 'whitespace-nowrap text-[11px] px-3 py-3')}
                >
                  {col.value ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
