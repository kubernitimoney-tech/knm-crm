import type { AuthUser } from '@/types/auth';

type ShellUser = Pick<AuthUser, 'email' | 'full_name'> & { display_name?: string };

/**
 * Name for the app shell only (navbar, sidebar, profile, greetings).
 * Loan and business data must keep using the official `full_name`.
 */
export function getShellDisplayName(user: ShellUser | null | undefined, fallback = 'User'): string {
  if (!user) return fallback;
  return user.display_name?.trim() || user.full_name?.trim() || user.email || fallback;
}

export function getShellInitials(user: ShellUser | null | undefined): string {
  const name = getShellDisplayName(user, '');
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'U';
}
