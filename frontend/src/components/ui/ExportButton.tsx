import type { ComponentProps } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionBinding } from '@/lib/resolvePermissionBinding';
import { cn } from '@/lib/utils';

type ExportButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'children'> & {
  label?: string;
  /**
   * Required permission code(s) to show the button (any-of if array).
   * Super admin always sees the button. Omit only when the page has no export RBAC.
   */
  permission?: PermissionBinding;
};

export function ExportButton({
  onClick,
  label = 'Export to Excel',
  className,
  disabled,
  permission,
  ...props
}: ExportButtonProps) {
  const { canAny } = usePermissions();

  if (permission != null && !canAny(permission)) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn('h-9 px-4 text-xs font-semibold rounded-md', className)}
      {...props}
    >
      <Download className="w-4 h-4 mr-1" />
      {label}
    </Button>
  );
}
