import { NAVIGATION_ITEMS } from './navigation';

/** Full-path labels take precedence over single-segment fallbacks. */
export const BREADCRUMB_PATH_LABELS: Record<string, string> = {
  '/profile': 'My Profile',
  '/customers': 'Customers',
  '/leads': 'Leads',
  '/leads/status': 'Status Wise',
  '/leads/all': 'All',
  '/sanctions': 'Sanctions',
  '/sanctions/approved': 'Approved',
  '/sanctions/pending': 'Pending For Approval',
  '/sanctions/rejected': 'Rejected',
  '/sanctions/enach': 'E-Nach Registration',
  '/disbursal': 'Disbursal',
  '/disbursal/sheet': 'Disbursal Sheet Send',
  '/disbursal/completed': 'Disbursed',
  '/collection': 'Collection',
  '/collection/pending': 'Cash Pending',
  '/collection/partial': 'Part Payment',
  '/collection/closed': 'Closed',
  '/collection/settlement': 'Settlement',
  '/reports': 'Reporting',
  '/reports/cibil': 'Cibil Report',
  '/reports/all': 'All Reporting Data',
  '/reports/activity-logs': 'Activity Logs',
  '/assignments': 'Lead Assignment',
  '/assignments/rm': 'RM List',
  '/assignments/cm': 'CM List',
  '/assignments/matrix': 'Matrix Loan Approval',
  '/kyc': 'KYC',
  '/kyc/esign': 'E-Sign',
  '/kyc/video': 'Video KYC',
  '/marketing': 'Marketing',
  '/marketing/branch': 'Branch-Wise Reports',
  '/marketing/utm': 'UTM-Wise Reports',
  '/master': 'Master',
  '/master/users': 'Users',
  '/master/permissions': 'Permissions',
  '/master/permissions/catalog': 'Permission Catalog',
  '/master/permissions/roles': 'Roles',
  '/master/permissions/assignments': 'Role Assignment',
  '/master/permissions/overrides': 'User Overrides',
  '/master/category': 'Settings',
  '/master/category/optional-module': 'Optional Module',
  '/master/category/branch-target': 'Branch Target',
  '/master/category/bank-holidays': 'Bank Holidays',
  '/master/category/sanction-target': 'Sanction Target',
  '/master/category/approval-matrix': 'Approval Matrix',
  '/master/permission-matrix': 'Permission Matrix',
  '/master/category/permission-matrix': 'Permission Matrix',
  '/red-flag': 'Red Flag',
};

/**
 * Paths that exist as real app routes (safe breadcrumb links).
 * Intermediate section paths like /leads or /sanctions are intentionally excluded.
 */
export const BREADCRUMB_LINKABLE_PATHS = new Set<string>();

function registerPath(path: string, label: string, linkable = true) {
  if (!BREADCRUMB_PATH_LABELS[path]) {
    BREADCRUMB_PATH_LABELS[path] = label;
  }
  if (linkable) {
    BREADCRUMB_LINKABLE_PATHS.add(path);
  }
}

// Real nav destinations
for (const item of NAVIGATION_ITEMS) {
  if (item.path && item.path !== '/') {
    registerPath(item.path, item.title, true);
  }
  for (const sub of item.submenu ?? []) {
    registerPath(sub.path, BREADCRUMB_PATH_LABELS[sub.path] ?? sub.title, true);
  }
}

// Section roots used only as non-clickable breadcrumb parents
const SECTION_PARENTS: Array<[string, string]> = [
  ['/leads', 'Leads'],
  ['/sanctions', 'Sanctions'],
  ['/disbursal', 'Disbursal'],
  ['/collection', 'Collection'],
  ['/reports', 'Reporting'],
  ['/assignments', 'Lead Assignment'],
  ['/kyc', 'KYC'],
  ['/marketing', 'Marketing'],
  ['/master', 'Master'],
  ['/customers', 'Customers'],
];

for (const [path, label] of SECTION_PARENTS) {
  BREADCRUMB_PATH_LABELS[path] = label;
  // Do not add to BREADCRUMB_LINKABLE_PATHS
}

/** Override leaf titles that should stay short in breadcrumb (e.g. All vs All Leads). */
const LEAF_OVERRIDES: Record<string, string> = {
  '/leads/all': 'All',
  '/leads/status': 'Status Wise',
  '/sanctions/approved': 'Approved',
  '/sanctions/pending': 'Pending For Approval',
  '/sanctions/rejected': 'Rejected',
  '/sanctions/enach': 'E-Nach Registration',
};

for (const [path, label] of Object.entries(LEAF_OVERRIDES)) {
  BREADCRUMB_PATH_LABELS[path] = label;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidSegment(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function formatBreadcrumbSegment(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function resolveBreadcrumbLabel(
  pathnames: string[],
  index: number,
  segmentLabels?: Record<string, string>,
): string {
  const segment = pathnames[index];
  const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;

  if (segmentLabels?.[segment]) {
    return segmentLabels[segment];
  }
  if (BREADCRUMB_PATH_LABELS[routeTo]) {
    return BREADCRUMB_PATH_LABELS[routeTo];
  }
  if (isUuidSegment(segment) || /^\d+$/.test(segment)) {
    return 'Details';
  }
  return formatBreadcrumbSegment(segment);
}

/** Whether this breadcrumb path should be an anchor (known route). */
export function isBreadcrumbLinkable(routeTo: string): boolean {
  if (BREADCRUMB_LINKABLE_PATHS.has(routeTo)) {
    return true;
  }
  // Dynamic detail URLs: /leads/all/:id, /master/users/:id, /customers/:id
  const parts = routeTo.split('/').filter(Boolean);
  if (parts.length >= 3 && isUuidSegment(parts[parts.length - 1])) {
    return false;
  }
  if (parts.length >= 2 && isUuidSegment(parts[parts.length - 1])) {
    // e.g. /customers/:id — leaf only; parent /customers not linkable unless registered
    return false;
  }
  return false;
}
