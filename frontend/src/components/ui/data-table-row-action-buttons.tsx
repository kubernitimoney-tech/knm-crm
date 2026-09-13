import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Eye, PenLine, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  ROW_ACTION_ICON_CLASS,
  ROW_DELETE_ICON_BUTTON_CLASS,
  ROW_DELETE_ICON_CLASS,
  ROW_EDIT_ICON_BUTTON_CLASS,
  ROW_EDIT_ICON_CLASS,
  ROW_TRANSFER_ICON_BUTTON_CLASS,
  ROW_TRANSFER_ICON_CLASS,
  ROW_VIEW_ICON_BUTTON_CLASS,
  ROW_VIEW_ICON_CLASS,
} from '@/lib/uiTokens';
import { cn } from '@/lib/utils';

type RowActionButtonProps = {
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
};

type RowViewButtonProps = RowActionButtonProps & {
  /** In-app route — real link (Ctrl+click opens new tab). */
  to?: string;
  /** External URL — opens in new tab; Ctrl+click works natively. */
  href?: string;
  /** Open in-app route in a new browser tab. */
  newTab?: boolean;
};

function rowViewButtonClassName(className?: string) {
  return cn(buttonVariants({ variant: 'ghost', size: 'icon' }), ROW_VIEW_ICON_BUTTON_CLASS, className);
}

export function RowViewButton({
  to,
  href,
  onClick,
  newTab,
  title = 'View',
  'aria-label': ariaLabel = 'View record',
  disabled,
  className,
}: RowViewButtonProps) {
  const icon = <Eye className={cn(ROW_ACTION_ICON_CLASS, ROW_VIEW_ICON_CLASS)} />;
  const classes = rowViewButtonClassName(className);

  if (disabled) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(ROW_VIEW_ICON_BUTTON_CLASS, className)}
        disabled
        title={title}
        aria-label={ariaLabel}
      >
        {icon}
      </Button>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        className={classes}
        title={title}
        aria-label={ariaLabel}
      >
        {icon}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        title={title}
        aria-label={ariaLabel}
      >
        {icon}
      </a>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(ROW_VIEW_ICON_BUTTON_CLASS, className)}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </Button>
  );
}

export function RowEditButton({
  onClick,
  title = 'Edit',
  'aria-label': ariaLabel = 'Edit record',
  disabled,
  className,
}: RowActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(ROW_EDIT_ICON_BUTTON_CLASS, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      <PenLine className={cn(ROW_ACTION_ICON_CLASS, ROW_EDIT_ICON_CLASS)} />
    </Button>
  );
}

export function RowDeleteButton({
  onClick,
  title = 'Delete',
  'aria-label': ariaLabel = 'Delete record',
  disabled,
  className,
}: RowActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(ROW_DELETE_ICON_BUTTON_CLASS, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      <Trash2 className={cn(ROW_ACTION_ICON_CLASS, ROW_DELETE_ICON_CLASS)} />
    </Button>
  );
}

export function RowTransferButton({
  onClick,
  title = 'Transfer',
  'aria-label': ariaLabel = 'Transfer record',
  disabled,
  className,
}: RowActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(ROW_TRANSFER_ICON_BUTTON_CLASS, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      <ArrowRightLeft className={cn(ROW_ACTION_ICON_CLASS, ROW_TRANSFER_ICON_CLASS)} />
    </Button>
  );
}

export function RowActionButtonGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center gap-1">{children}</div>;
}
