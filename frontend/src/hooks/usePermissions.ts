import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ALL_NAV_SECTIONS,
  type NavSection,
  resolveNavSections,
  pathToNavSection,
  getRequiredPermissionsForPath,
  getAnyPermissionsForPath,
  isWorkflowDetailPath,
  WORKFLOW_DETAIL_READ_PERMISSIONS,
} from '@/constants/permissions';
import {
  PERMISSION_UI_MANIFEST,
  type PermissionUiPage,
} from '@/constants/permissionUiManifest';
import { resolvePrimaryRoleName, formatRoleDisplayNames } from '@/constants/roles';
import { NAVIGATION_ITEMS, type NavItem } from '@/constants/navigation';
import {
  permissionCode,
  resolveAllPermissionBindings,
  resolvePermissionBinding,
  type PermissionBinding,
} from '@/lib/resolvePermissionBinding';

export function usePermissions() {
  const { roles, permissions, access } = useAuthStore();

  const isSuperAdmin = access?.is_super_admin ?? false;
  const isAdmin = access?.is_admin ?? false;
  const canEdit = access?.can_edit ?? false;
  const canDelete = access?.can_delete ?? false;
  const canGrantPermission = access?.can_grant_permission ?? false;
  const canGrantDeletePermission =
    access?.can_grant_delete_permission ?? isSuperAdmin;
  const canAssignRoles = access?.can_assign_roles ?? false;
  const canCreateUser =
    access?.can_create_user ?? (isSuperAdmin || permissions.includes('user.create'));

  const hasPermission = useCallback(
    (code: string) => isSuperAdmin || permissions.includes(code),
    [isSuperAdmin, permissions],
  );

  const can = useCallback(
    (module: string, action: string) => hasPermission(permissionCode(module, action)),
    [hasPermission],
  );

  const canAny = useCallback(
    (binding: PermissionBinding) => resolvePermissionBinding(binding, hasPermission),
    [hasPermission],
  );

  const canAll = useCallback(
    (binding: PermissionBinding) => resolveAllPermissionBindings(binding, hasPermission),
    [hasPermission],
  );

  const canUi = useCallback(
    (page: PermissionUiPage, section: string, action: string) => {
      const pageManifest = PERMISSION_UI_MANIFEST[page];
      const sectionManifest = pageManifest?.[section as keyof typeof pageManifest];
      if (!sectionManifest || typeof sectionManifest !== 'object') return false;
      const binding = (sectionManifest as Record<string, PermissionBinding | undefined>)[action];
      return resolvePermissionBinding(binding, hasPermission);
    },
    [hasPermission],
  );

  function hasRole(slug: string) {
    return isSuperAdmin || roles.some((role) => role.slug === slug);
  }

  const isCollectionOfficer = hasRole('collection-officer');

  function hasPathPermission(pathname: string) {
    const required = getRequiredPermissionsForPath(pathname);
    if (required.length > 0 && !required.every((code) => hasPermission(code))) {
      return false;
    }
    const anyOf = getAnyPermissionsForPath(pathname);
    if (anyOf.length > 0 && !anyOf.some((code) => hasPermission(code))) {
      return false;
    }
    return true;
  }

  const navSections = useMemo(
    () => resolveNavSections(roles, isSuperAdmin),
    [roles, isSuperAdmin],
  );

  const canAccessSection = (section: NavSection) =>
    isSuperAdmin || navSections.includes(section);

  const canAccessPath = (pathname: string) => {
    const path = pathname.replace(/\/+$/, '') || '/';

    // Hidden from nav but reachable by direct URL for audit/compliance roles.
    if (path === '/reports/activity-logs') {
      return hasPermission('audit.view');
    }

    if (isWorkflowDetailPath(pathname)) {
      return WORKFLOW_DETAIL_READ_PERMISSIONS.some((code) => hasPermission(code));
    }

    if (!hasPathPermission(pathname)) {
      return false;
    }

    const section = pathToNavSection(pathname);
    if (!section) return true;
    return canAccessSection(section);
  };

  const filteredNavItems = useMemo(() => {
    const canAccess = (section: NavSection) => isSuperAdmin || navSections.includes(section);

    const canAccessNavPath = (path: string) => {
      if (isWorkflowDetailPath(path)) {
        return WORKFLOW_DETAIL_READ_PERMISSIONS.some((code) => hasPermission(code));
      }
      if (!hasPathPermission(path)) {
        return false;
      }
      const section = pathToNavSection(path);
      if (section && !canAccess(section)) {
        return false;
      }
      return true;
    };

    return NAVIGATION_ITEMS.map((item) => {
      if (item.section && !canAccess(item.section)) return null;
      if (item.path && !canAccessNavPath(item.path)) return null;
      if (item.submenu) {
        const submenu = item.submenu.filter((sub) => {
          if (sub.section && !canAccess(sub.section)) return false;
          if (!canAccessNavPath(sub.path)) return false;
          return true;
        });
        if (submenu.length === 0) return null;
        return { ...item, submenu };
      }
      return item;
    }).filter((item): item is NavItem => item !== null);
  }, [navSections, isSuperAdmin, permissions]);

  const primaryRoleName = resolvePrimaryRoleName(roles, isSuperAdmin);
  const roleNamesLabel = formatRoleDisplayNames(roles);

  return {
    roles,
    permissions,
    isSuperAdmin,
    isAdmin,
    canEdit,
    canDelete,
    canGrantPermission,
    canGrantDeletePermission,
    canCreateUser,
    canAssignRoles,
    navSections,
    allSections: ALL_NAV_SECTIONS,
    canAccessSection,
    canAccessPath,
    hasPermission,
    can,
    canAny,
    canAll,
    canUi,
    hasRole,
    isCollectionOfficer,
    filteredNavItems,
    primaryRoleName,
    roleNamesLabel,
  };
}
