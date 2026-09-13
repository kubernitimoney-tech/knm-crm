/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import {
  RowActionButtonGroup,
  RowDeleteButton,
  RowEditButton,
  RowViewButton,
} from '@/components/ui/data-table-row-action-buttons';
import { WORKFLOW_DETAIL_READ_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionBinding } from '@/lib/resolvePermissionBinding';
import { cn } from '@/lib/utils';
import { dataTableHeadClass } from '@/components/ui/data-table';
import { TableHead } from '@/components/ui/table';

export {
  RowActionButtonGroup,
  RowDeleteButton,
  RowEditButton,
  RowTransferButton,
  RowViewButton,
} from '@/components/ui/data-table-row-action-buttons';

export interface DataTableActionColumnVisibility {
  showColumn: boolean;
  showView: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showExtra: boolean;
}

export interface DataTableActionColumnOptions {
  view?: boolean;
  edit?: boolean;
  delete?: boolean;
  extra?: boolean;
}

/** Whether the listing table should render an Action column. */
export function useDataTableActionColumn(
  options: DataTableActionColumnOptions,
): DataTableActionColumnVisibility {
  const showView = options.view ?? false;
  const showEdit = options.edit ?? false;
  const showDelete = options.delete ?? false;
  const showExtra = options.extra ?? false;
  const showColumn = showView || showEdit || showDelete || showExtra;
  return { showColumn, showView, showEdit, showDelete, showExtra };
}

type PermissionFlag = boolean | PermissionBinding | undefined;

/**
 * Resolve action visibility from booleans or permission codes.
 * - `true` → always show
 * - `false` / omitted → hide
 * - string | string[] → show when user has any listed permission (super-admin has all)
 */
export function usePermissionActionColumn(options: {
  view?: PermissionFlag;
  edit?: PermissionFlag;
  delete?: PermissionFlag;
  extra?: boolean;
}): DataTableActionColumnVisibility {
  const { canAny } = usePermissions();

  const resolve = (flag: PermissionFlag): boolean => {
    if (flag === undefined || flag === false) return false;
    if (flag === true) return true;
    return canAny(flag);
  };

  return useDataTableActionColumn({
    view: resolve(options.view),
    edit: resolve(options.edit),
    delete: resolve(options.delete),
    extra: options.extra ?? false,
  });
}

/**
 * Lead/pipeline listing pages: view / edit / delete gate on permission codes.
 * Transfer (extra) must be enabled by the parent when the user has lead.assign.
 */
export function useLeadListingActionColumn(options?: {
  extra?: boolean;
  /** Default true — eye icon when user can open workflow detail. */
  view?: boolean;
}) {
  return usePermissionActionColumn({
    view: options?.view === false ? false : [...WORKFLOW_DETAIL_READ_PERMISSIONS],
    edit: 'lead.update',
    delete: 'lead.delete',
    extra: options?.extra ?? false,
  });
}

export interface DataTableActionHeadProps {
  visible?: boolean;
  className?: string;
}

export function DataTableActionHead({ visible = true, className }: DataTableActionHeadProps) {
  if (!visible) return null;
  return (
    <TableHead className={cn(dataTableHeadClass, dataTableActionHeadClass, className)}>
      Action
    </TableHead>
  );
}

export interface DataTableListingActionsProps {
  /** In-app route for view action (supports Ctrl+click). Prefer over onView for navigation. */
  viewTo?: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  deleteTitle?: string;
  deleteDescription?: string;
  deleteConfirmLabel?: string;
  viewTitle?: string;
  editTitle?: string;
  deleteTitleAttr?: string;
  extraActions?: React.ReactNode;
  /** When true, delete click delegates to onDelete without the built-in confirm dialog. */
  externalDeleteConfirm?: boolean;
  /** When true, Edit/Delete show only when handlers + visibility allow. */
  requireHandlers?: boolean;
  /** Precomputed visibility from useDataTableActionColumn / useLeadListingActionColumn. */
  visibility?: DataTableActionColumnVisibility;
}

export function DataTableListingActions({
  viewTo,
  onView,
  onEdit,
  onDelete,
  deleteTitle = 'Delete this record?',
  deleteDescription = 'This action cannot be undone.',
  deleteConfirmLabel = 'Delete',
  viewTitle = 'View',
  editTitle = 'Edit',
  deleteTitleAttr = 'Delete',
  extraActions,
  externalDeleteConfirm = false,
  requireHandlers = true,
  visibility,
}: DataTableListingActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Prefer explicit visibility from permission hooks. Without it, hide row actions.
  const showView = Boolean(visibility?.showView && (viewTo || onView));
  const showEdit = Boolean(visibility?.showEdit && (!requireHandlers || onEdit));
  const showDelete = Boolean(visibility?.showDelete && (!requireHandlers || onDelete));
  const showExtra = Boolean(visibility?.showExtra && extraActions);
  const hasActions = showView || showExtra || showEdit || showDelete;

  if (!hasActions) {
    return null;
  }

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
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
        {showView && (viewTo || onView) && (
          <RowViewButton
            to={viewTo}
            onClick={viewTo ? undefined : onView}
            title={viewTitle}
          />
        )}
        {showExtra && extraActions}
        {showEdit && (
          <RowEditButton onClick={onEdit} disabled={!onEdit} title={editTitle} />
        )}
        {showDelete && (
          <RowDeleteButton
            onClick={() => {
              if (!onDelete) return;
              if (externalDeleteConfirm) {
                void onDelete();
                return;
              }
              setConfirmOpen(true);
            }}
            disabled={!onDelete}
            title={deleteTitleAttr}
          />
        )}
      </RowActionButtonGroup>
      {onDelete && showDelete && !externalDeleteConfirm && (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={deleteTitle}
          description={deleteDescription}
          confirmLabel={deleteConfirmLabel}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

export const dataTableActionHeadClass = 'w-[100px] pr-4 text-center';
