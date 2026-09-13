/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const tableFontClass = 'font-sans text-xs';

/** Standard body cell — same size, weight, and color for all data columns. */
export const dataTableCellClass = cn(
  tableFontClass,
  'px-4 py-1.5 font-normal text-slate-500 whitespace-nowrap dark:text-slate-400',
);

/** @deprecated Use dataTableCellClass */
export const mutedCellClass = dataTableCellClass;

/** @deprecated Use dataTableCellClass */
export const metricCellClass = dataTableCellClass;

export const dataTableActionCellClass = cn(dataTableCellClass, 'px-2 text-center');

export const dataTableCardClass =
  'overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-slate-900';

/** Vertical gap between table card and pagination footer (list pages). */
export const dataTableStackClass = 'space-y-3';

/** Inset bar — same horizontal width as table pagination footer (mx-3). */
export const dataTableInsetBarClass =
  'mx-3 rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-700 dark:bg-slate-900';

export const dataTableFilterControlClass =
  'h-8 min-h-8 rounded-md border-slate-200 bg-white text-xs font-medium leading-none text-slate-600 shadow-none py-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

export const dataTableDateRangeTriggerClass =
  'h-8 min-h-8 rounded-md px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

/** OMS-style filter toolbar — single light row above the table card. */
export const dataTableFilterToolbarClass =
  'flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 dark:border-slate-700 dark:bg-slate-900/40';

export const dataTableFilterDividerClass = 'hidden h-5 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700';

/** Primary page action button — matches lead list "New Lead" styling. */
export const dataTablePrimaryActionButtonClass =
  'h-9 bg-primary-deep hover:bg-primary-deep/90 text-white rounded-md px-4 text-xs font-semibold shadow-sm transition-all';

export function DataTableSearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-[200px] flex-1 max-w-xl', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('pl-8 focus-visible:ring-primary-deep/10', dataTableFilterControlClass)}
      />
    </div>
  );
}

export function DataTableClearFiltersButton({
  onClick,
  children = 'Clear',
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-7 rounded-md px-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
    >
      <X size={13} />
      {children}
    </Button>
  );
}

export function DataTablePageSizeSelect({
  value,
  onChange,
  options = [10, 20, 25, 50, 100],
  triggerWidth = 'w-16',
}: {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  triggerWidth?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Per Page:</span>
      <Select value={value.toString()} onValueChange={(val) => onChange(parseInt(val, 10))}>
        <SelectTrigger className={cn(triggerWidth, dataTableFilterControlClass)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DataTableFilterPill({
  label,
  count,
  active = false,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary-deep/25 bg-primary-deep/5 text-primary-deep dark:border-primary-deep/40 dark:bg-primary-deep/15 dark:text-slate-100'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800',
      )}
    >
      {label}
      {count !== undefined && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

export const dataTableHeaderClass =
  'bg-slate-50/80 border-b border-slate-200 dark:border-slate-700 dark:bg-slate-800/80';
export const dataTableHeaderRowClass = 'hover:bg-transparent';
export const dataTableWrapperClass = cn(
  tableFontClass,
  '[&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0 dark:[&_[data-slot=table-container]]:border-slate-800 dark:[&_[data-slot=table-container]]:bg-transparent',
);
export const dataTableBodyRowClass =
  'border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800/80 dark:bg-transparent dark:hover:bg-white/[0.03]';

export const dataTableHeadClass =
  'text-[10px] font-black text-slate-400 uppercase py-5 tracking-widest whitespace-nowrap dark:text-slate-300';
export const dataTableSortableHeadClass = cn(
  dataTableHeadClass,
  'cursor-pointer hover:text-primary-deep transition-colors',
);

export const indexCellClass = cn(
  tableFontClass,
  'w-[60px] pl-4 pr-0.5 py-1.5 font-normal text-slate-400 whitespace-nowrap text-center dark:text-slate-500',
);
export const nameCellClass = cn(tableFontClass, 'pl-0.5 pr-4 py-1.5 whitespace-nowrap');

/** Lead ID column — indigo so it stands out from other cells. */
export const dataTableLeadIdTextClass =
  'truncate font-semibold text-indigo-600 dark:text-indigo-400';

export const dataTableLeadIdAccentClass = 'bg-indigo-500';

/** Customer / borrower name column — teal, distinct from lead ID. */
export const dataTableCustomerNameTextClass =
  'truncate font-semibold text-teal-700 dark:text-teal-400';

const paginationButtonClass =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50/50 disabled:text-slate-300 disabled:hover:bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-600';
const paginationIconButtonClass = cn(paginationButtonClass, 'min-w-7 px-1.5');
const paginationTextButtonClass = cn(paginationButtonClass, 'px-2.5');

export function DataTablePrimaryCell({
  label,
  accentClassName,
  tone = 'lead-id',
  to,
  onClick,
  className,
}: {
  label: string;
  /** Accent bar color; defaults by tone. */
  accentClassName?: string;
  /** `lead-id` = indigo (default). `neutral` for non–lead-ID primary columns. */
  tone?: 'lead-id' | 'neutral';
  /** In-app route — renders a real link (supports Ctrl+click / open in new tab). */
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  const resolvedAccent =
    accentClassName ??
    (tone === 'neutral' ? 'bg-primary-deep/60' : dataTableLeadIdAccentClass);
  const textClass =
    tone === 'neutral'
      ? 'truncate font-semibold text-slate-900 dark:text-slate-100'
      : dataTableLeadIdTextClass;

  const linkClassName = cn(
    'block w-full min-w-0 text-left transition-colors',
    tone === 'lead-id'
      ? 'hover:text-indigo-700 dark:hover:text-indigo-300'
      : 'hover:opacity-80',
  );

  const content = (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className={cn('h-4 w-0.5 shrink-0 rounded-full', resolvedAccent)} aria-hidden />
      <span className={textClass}>{label}</span>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className={linkClassName}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={linkClassName}>
        {content}
      </button>
    );
  }

  return content;
}

export function DataTableCustomerNameCell({
  label,
  tone = 'customer',
  to,
  onClick,
  className,
}: {
  label: string;
  /** `customer` = teal (default). `neutral` for staff / non-borrower name columns. */
  tone?: 'customer' | 'neutral';
  /** In-app route — renders a real link (supports Ctrl+click / open in new tab). */
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  const textClass =
    tone === 'neutral'
      ? 'truncate font-semibold text-slate-900 dark:text-slate-100'
      : dataTableCustomerNameTextClass;

  const linkClassName = cn(
    'block w-full min-w-0 text-left transition-colors',
    tone === 'customer'
      ? 'hover:text-teal-800 hover:underline dark:hover:text-teal-300'
      : 'hover:text-primary-deep hover:underline',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={linkClassName}>
        <span className={textClass}>{label}</span>
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={linkClassName}>
        <span className={textClass}>{label}</span>
      </button>
    );
  }

  return (
    <span className={cn(textClass, 'block truncate', className)}>
      {label}
    </span>
  );
}

export function DataTableFooter({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  leftExtra,
  inset = true,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  leftExtra?: React.ReactNode;
  /** When false, footer sits below the table card at full width. */
  inset?: boolean;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div
      className={cn(
        inset
          ? cn(dataTableInsetBarClass, 'mb-3 mt-2')
          : 'rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900',
        'flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="shrink-0 text-xs leading-none text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {from}-{to}
          </span>{' '}
          of <span className="font-bold text-slate-900 dark:text-slate-100">{totalItems.toLocaleString()}</span>
        </p>
        {leftExtra}
      </div>

      <div className="flex items-center gap-0.5 self-end sm:self-auto">
        <button
          type="button"
          className={paginationIconButtonClass}
          disabled={isFirstPage}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft size={13} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={isFirstPage}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>
        <span className="min-w-[52px] px-1.5 text-center text-xs leading-none tabular-nums text-slate-800 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-slate-100">{currentPage}</span>
          <span className="mx-0.5 text-slate-500 dark:text-slate-500">/</span>
          <span>{totalPages.toLocaleString()}</span>
        </span>
        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={isLastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className={paginationIconButtonClass}
          disabled={isLastPage}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <ChevronsRight size={13} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
