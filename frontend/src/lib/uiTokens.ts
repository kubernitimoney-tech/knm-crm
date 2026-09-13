/** Shared amber styling for edit / update pencil actions. */
export const EDIT_GHOST_ICON_BUTTON_CLASS =
  'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/40';

/** @deprecated Use ROW_EDIT_ICON_BUTTON_CLASS for table row actions. */
export const EDIT_GHOST_ICON_BUTTON_MUTED_CLASS = EDIT_GHOST_ICON_BUTTON_CLASS;

export const EDIT_SOLID_ICON_BUTTON_CLASS =
  'bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500 shadow-sm';

export const EDIT_DIALOG_ICON_WRAP_CLASS =
  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';

export const EDIT_ICON_CLASS = 'text-amber-600 dark:text-amber-400';

/** Standard ghost icon buttons for table row View / Edit / Delete actions. */
export const ROW_ACTION_BUTTON_CLASS = 'group/row-action h-8 w-8 shrink-0';
export const ROW_ACTION_ICON_CLASS = 'h-4 w-4 shrink-0';

export const ROW_VIEW_ICON_CLASS =
  'text-indigo-600 group-hover/row-action:text-indigo-700 dark:text-indigo-400 dark:group-hover/row-action:text-indigo-300';

export const ROW_EDIT_ICON_CLASS =
  'text-amber-600 group-hover/row-action:text-amber-700 dark:text-amber-400 dark:group-hover/row-action:text-amber-300';

export const ROW_DELETE_ICON_CLASS =
  'text-rose-600 group-hover/row-action:text-rose-700 dark:text-rose-400 dark:group-hover/row-action:text-rose-300';

export const ROW_TRANSFER_ICON_CLASS =
  'text-amber-600 group-hover/row-action:text-amber-700 dark:text-amber-400 dark:group-hover/row-action:text-amber-300';

export const ROW_VIEW_ICON_BUTTON_CLASS =
  'group/row-action h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-950/40';

export const ROW_EDIT_ICON_BUTTON_CLASS =
  'group/row-action h-8 w-8 hover:bg-amber-50 dark:hover:bg-amber-950/40';

export const ROW_DELETE_ICON_BUTTON_CLASS =
  'group/row-action h-8 w-8 hover:bg-rose-50 dark:hover:bg-rose-950/30';

/** Lead transfer / reassign row action (amber family). */
export const ROW_TRANSFER_ICON_BUTTON_CLASS =
  'group/row-action h-8 w-8 hover:bg-amber-50 dark:hover:bg-amber-950/40';

/** Stacking: navbar < page chrome < modals/menus < toasts */
export const Z_NAV = 'z-40';
export const Z_OVERLAY = 'z-[120]';
export const Z_MENU = 'z-[130]';

/** Shared modal / drawer surfaces for custom overlays (prefer Dialog when possible). */
export const MODAL_OVERLAY_CLASS =
  `${Z_OVERLAY} fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 dark:bg-black/65`;

export const MODAL_PANEL_CLASS =
  'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#252849] dark:shadow-black/50';

export const MODAL_HEADER_CLASS =
  'flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4 dark:border-white/10 dark:bg-white/[0.04]';

export const DRAWER_OVERLAY_CLASS =
  `${Z_OVERLAY} fixed inset-0 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 dark:bg-black/65`;

export const DRAWER_PANEL_CLASS =
  'flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#252849] dark:shadow-black/50';

export const SURFACE_CARD_CLASS =
  'bg-white dark:bg-[#32355a] dark:border-white/10';

export const SURFACE_INPUT_CLASS =
  'bg-slate-50 border border-slate-200 dark:bg-[#2a2d4f] dark:border-white/12 dark:text-slate-100';
