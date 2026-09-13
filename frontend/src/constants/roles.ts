/** Backend RBAC role slugs aligned with seed_permissions.py */
export interface SystemRole {
  slug: string;
  name: string;
  display_name: string;
}

export const SYSTEM_ROLES: SystemRole[] = [
  { slug: 'super-admin', name: 'Super Admin', display_name: 'Super Admin' },
  { slug: 'admin', name: 'Admin', display_name: 'Admin' },
  { slug: 'production-manager', name: 'Production Manager', display_name: 'Prod. Mgr' },
  { slug: 'relationship-manager', name: 'Relationship Manager', display_name: 'RM' },
  { slug: 'senior-relationship-manager', name: 'Senior Relationship Manager', display_name: 'Sr. RM' },
  { slug: 'credit-manager', name: 'Credit Manager', display_name: 'CM' },
  { slug: 'senior-credit-manager', name: 'Senior Credit Manager', display_name: 'Sr. CM' },
  { slug: 'field-investigator', name: 'Field Investigator', display_name: 'FI' },
  { slug: 'account-finance', name: 'Account & Finance', display_name: 'Finance' },
  { slug: 'collection-officer', name: 'Collection Officer', display_name: 'Collection' },
  { slug: 'auditor', name: 'Auditor', display_name: 'Auditor' },
];

export const ROLE_HIERARCHY_LABEL = `Super Admin
├── Admin
├── Production Manager
├── Senior Credit Manager (SCM)
├── Credit Manager (CM)
├── Senior Relationship Manager (SRM)
├── Relationship Manager (RM)
├── Field Investigator (FI)
├── Finance
├── Collection Officer
└── Auditor`;

export function getRoleDisplayName(slug: string): string {
  const role = SYSTEM_ROLES.find((r) => r.slug === slug);
  return role?.display_name ?? role?.name ?? slug;
}

export function getRoleFullName(slug: string): string {
  return SYSTEM_ROLES.find((r) => r.slug === slug)?.name ?? slug;
}

type RoleLabel = { name: string; display_name?: string };

function roleCompactLabel(role: RoleLabel): string {
  return role.display_name?.trim() || role.name;
}

/** Prefer assigned RBAC roles from the backend for compact UI labels. */
export function resolvePrimaryRoleName(
  roles: RoleLabel[],
  isSuperAdmin: boolean,
): string {
  if (roles.length > 0) {
    return formatRoleDisplayNames(roles);
  }
  if (isSuperAdmin) return 'Super Admin';
  return 'User';
}

export function formatRoleDisplayNames(roles: RoleLabel[]): string {
  if (roles.length === 0) return 'User';
  return roles.map(roleCompactLabel).join(' · ');
}

/** Full role names for detail views, audit logs, etc. */
export function formatRoleNames(roles: RoleLabel[]): string {
  if (roles.length === 0) return 'User';
  return roles.map((role) => role.name).join(' · ');
}
