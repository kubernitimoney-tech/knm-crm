export type DialogChangeEventDetails = {
  reason?: string;
  event?: Event;
  cancel?: () => void;
};

/** Base UI dismiss reason for the Escape key. */
export const DIALOG_ESCAPE_REASON = 'escape-key';

/** Attribute for Cancel / explicit dismiss controls (Circle-X uses data-slot="dialog-close"). */
export const DIALOG_DISMISS_SELECTOR =
  '[data-slot="dialog-close"], [data-dialog-dismiss]';

/**
 * Returns true when the user intentionally dismissed the dialog (X, Cancel, Escape).
 */
export function isExplicitDialogDismiss(
  eventDetails: DialogChangeEventDetails | undefined,
): boolean {
  if (eventDetails?.reason === DIALOG_ESCAPE_REASON) return true;

  const target = eventDetails?.event?.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(DIALOG_DISMISS_SELECTOR));
}

/**
 * Returns true when a dialog close should be cancelled (e.g. outside click on a portaled select).
 * Escape and explicit dismiss (X / Cancel) always close the dialog.
 */
export function shouldKeepDialogOpen(
  eventDetails: DialogChangeEventDetails | undefined,
  selectOpen: boolean,
): boolean {
  if (isExplicitDialogDismiss(eventDetails)) return false;

  if (selectOpen && eventDetails?.reason === 'outside-press') return true;

  const target = eventDetails?.event?.target;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '[data-slot="select-content"], [data-slot="select-item"], [role="listbox"], [role="option"], [data-base-ui-portal]',
    ),
  );
}

/**
 * Controlled dialog onOpenChange helper: respects select-outside guard, then dismisses and closes.
 */
export function handleDialogOpenChange(
  open: boolean,
  eventDetails: DialogChangeEventDetails | undefined,
  options: {
    selectOpen?: boolean;
    onOpenChange: (open: boolean) => void;
    onDismiss?: () => void;
  },
): void {
  if (!open) {
    if (shouldKeepDialogOpen(eventDetails, options.selectOpen ?? false)) {
      eventDetails?.cancel?.();
      return;
    }
    options.onDismiss?.();
    options.onOpenChange(false);
    return;
  }
  options.onOpenChange(true);
}
