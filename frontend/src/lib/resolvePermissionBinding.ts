/** Permission code or composite rule used by the UI manifest. */
export type PermissionBinding = string | readonly string[];

export function permissionCode(module: string, action: string): string {
  return `${module}.${action}`;
}

export function resolvePermissionBinding(
  binding: PermissionBinding | undefined,
  hasPermission: (code: string) => boolean,
): boolean {
  if (!binding) return false;
  if (typeof binding === 'string') return hasPermission(binding);
  return binding.some((code) => hasPermission(code));
}

export function resolveAllPermissionBindings(
  binding: PermissionBinding | undefined,
  hasPermission: (code: string) => boolean,
): boolean {
  if (!binding) return false;
  if (typeof binding === 'string') return hasPermission(binding);
  return binding.every((code) => hasPermission(code));
}
