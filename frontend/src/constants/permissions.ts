import type { AuthRole } from '@/types/auth';

/** Sidebar / route section identifiers */
export type NavSection =
  | 'dashboard'
  | 'leads'
  | 'sanction'
  | 'disbursal'
  | 'collection'
  | 'red-flag'
  | 'reporting'
  | 'assignments'
  | 'kyc'
  | 'marketing'
  | 'master';

export const ALL_NAV_SECTIONS: NavSection[] = [
  'dashboard',
  'leads',
  'sanction',
  'disbursal',
  'collection',
  'red-flag',
  'reporting',
  'assignments',
  'kyc',
  'marketing',
  'master',
];

/** UI nav visibility per role slug (from backend RBAC) */
export const ROLE_NAV_SECTIONS: Record<string, NavSection[]> = {
  'super-admin': ALL_NAV_SECTIONS,
  admin: ALL_NAV_SECTIONS,
  'production-manager': ALL_NAV_SECTIONS,
  'relationship-manager': ['dashboard', 'leads'],
  'senior-relationship-manager': ['dashboard', 'leads'],
  'credit-manager': ['dashboard', 'leads', 'sanction', 'disbursal', 'collection', 'red-flag', 'reporting', 'kyc'],
  'senior-credit-manager': ['dashboard', 'leads', 'sanction', 'disbursal', 'collection', 'red-flag', 'reporting', 'kyc'],
  'account-finance': ['dashboard', 'sanction', 'disbursal', 'collection', 'reporting'],
  'collection-officer': ['dashboard', 'collection'],
  auditor: ['dashboard', 'leads', 'sanction', 'disbursal', 'collection', 'red-flag', 'reporting', 'kyc'],
  // field-investigator: intentionally omitted — no UI access for now
};

export function resolveNavSections(roles: AuthRole[], isSuperAdmin: boolean): NavSection[] {
  if (isSuperAdmin) return ALL_NAV_SECTIONS;

  const sections = new Set<NavSection>();
  for (const role of roles) {
    const mapped = ROLE_NAV_SECTIONS[role.slug];
    if (mapped) mapped.forEach((s) => sections.add(s));
  }
  return Array.from(sections);
}

/** Permissions that allow opening lead/customer detail from pipeline & reporting tables. */
export const WORKFLOW_DETAIL_READ_PERMISSIONS = [
  'disbursal.view',
  'loan.view',
  'collection.view',
  'report.view',
  'lead.view',
  'application.view',
] as const;

export function isWorkflowDetailPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (/^\/leads\/all\/[^/]+$/.test(path)) return true;
  if (/^\/customers\/[^/]+$/.test(path)) return true;
  return false;
}

/** Paths that require explicit permission codes (in addition to nav section checks). */
export function getRequiredPermissionsForPath(pathname: string): string[] {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/master/permission-matrix' || path === '/master/category/permission-matrix') {
    return ['permission.view'];
  }

  if (path === '/master/permissions/catalog') {
    return ['permission.view'];
  }

  if (path === '/master/permissions/roles') {
    return ['role.view'];
  }

  if (
    path === '/master/permissions/assignments' ||
    path === '/master/permissions/overrides'
  ) {
    return ['user.view'];
  }

  if (path.startsWith('/master/users')) {
    return ['user.view'];
  }

  return [];
}

/** Paths that grant access when the user holds any listed permission. */
export function getAnyPermissionsForPath(pathname: string): string[] {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (
    path === '/sanctions/pending' ||
    path === '/sanctions/rejected' ||
    path === '/sanctions/approved'
  ) {
    return ['application.sanction', 'application.approve', 'application.reject', 'application.view'];
  }

  if (path === '/master/permissions') {
    return ['permission.view', 'role.view', 'user.view'];
  }

  return [];
}

/** Map URL path to nav section for route guards */
export function pathToNavSection(pathname: string): NavSection | null {
  if (pathname === '/' || pathname === '/profile') return 'dashboard';
  if (pathname.startsWith('/leads') || pathname.startsWith('/customers')) return 'leads';
  if (pathname.startsWith('/sanctions')) return 'sanction';
  if (pathname.startsWith('/disbursal')) return 'disbursal';
  if (pathname.startsWith('/collection')) return 'collection';
  if (pathname.startsWith('/red-flag')) return 'red-flag';
  if (pathname.startsWith('/reports')) return 'reporting';
  if (pathname.startsWith('/assignments')) return 'assignments';
  if (pathname.startsWith('/kyc')) return 'kyc';
  if (pathname.startsWith('/marketing')) return 'marketing';
  if (pathname.startsWith('/master')) return 'master';
  return null;
}
