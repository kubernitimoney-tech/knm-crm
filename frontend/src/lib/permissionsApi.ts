import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from '@/lib/api';

export interface MatrixPermission {
  id: string;
  code: string;
  module: string;
  action: string;
  action_label: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  is_critical: boolean;
  role_count?: number;
  direct_grant_count?: number;
}

export interface MatrixModule {
  module: string;
  name: string;
  description?: string;
  permissions: MatrixPermission[];
  count?: number;
}

export interface MatrixRole {
  id: string;
  slug: string;
  name: string;
  display_name?: string;
  description: string;
  is_locked: boolean;
  permission_codes: string[];
  granted_count: number;
}

export interface PermissionMatrixData {
  modules: MatrixModule[];
  roles: MatrixRole[];
  total_permissions: number;
}

export interface PermissionAuditLog {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_role: string;
  action_type: 'grant' | 'revoke';
  permission_name: string;
  permission_code: string;
  module_name: string;
  role_name: string;
  role_slug: string;
  file_name: string;
  file_size: string;
  approval_email_url: string | null;
  created_at: string;
}

export interface PermissionCatalogData {
  modules: MatrixModule[];
  total_permissions: number;
  actions: { value: string; label: string }[];
  module_options: { value: string; label: string }[];
  status_options?: { value: string; label: string }[];
}

export interface CreatePermissionPayload {
  module: string;
  action: string;
  status?: 'active' | 'inactive';
}

export interface RoleDirectoryItem {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  description: string;
  is_active: boolean;
  status?: 'active' | 'inactive';
  is_locked: boolean;
  permission_count: number;
  user_count: number;
  created_at: string | null;
}

export interface RoleAssignee {
  user_id: string;
  email: string;
  full_name: string;
  employee_code: string;
  is_active: boolean;
  assigned_at: string | null;
  assigned_by_name: string | null;
}

export interface UserPermissionInventory {
  user: {
    id: string;
    email: string;
    full_name: string;
    employee_code: string;
    is_active: boolean;
  };
  roles: {
    slug: string;
    name: string;
    display_name: string;
    assigned_at: string | null;
    assigned_by_name: string | null;
    permission_codes: string[];
    permission_count: number;
    is_locked: boolean;
  }[];
  overrides: {
    id: string;
    permission_id: string;
    permission_code: string;
    module: string;
    action: string;
    is_critical: boolean;
    granted_at: string | null;
    granted_by_name: string | null;
    also_from_role: boolean;
  }[];
  effective_permissions: {
    code: string;
    sources: string[];
    from_role: boolean;
    from_override: boolean;
  }[];
  effective_count: number;
  role_permission_count: number;
  override_count: number;
  history: {
    id: string;
    action: string;
    permission_code: string;
    performed_by_name: string | null;
    created_at: string;
    approval_email_url: string | null;
  }[];
}

export async function fetchPermissionCatalog(params?: {
  module?: string;
  search?: string;
}): Promise<PermissionCatalogData> {
  const query = new URLSearchParams();
  if (params?.module) query.set('module', params.module);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiGet<PermissionCatalogData>(`/accounts/permissions/catalog/${qs ? `?${qs}` : ''}`);
}

export async function createPermission(
  payload: CreatePermissionPayload,
): Promise<MatrixPermission> {
  return apiPost<MatrixPermission>('/accounts/permissions/catalog/', payload);
}

export async function updatePermission(
  permissionId: string,
  payload: CreatePermissionPayload,
): Promise<MatrixPermission> {
  return apiPatch<MatrixPermission>(`/accounts/permissions/catalog/${permissionId}/`, payload);
}

export async function deletePermission(permissionId: string): Promise<{
  id: string;
  code: string;
  status: string;
}> {
  return apiDelete(`/accounts/permissions/catalog/${permissionId}/`);
}

export async function fetchRoleDirectory(): Promise<{ roles: RoleDirectoryItem[]; total: number }> {
  return apiGet<{ roles: RoleDirectoryItem[]; total: number }>('/accounts/roles/directory/');
}

export interface CreateRolePayload {
  name: string;
  display_name?: string;
  slug?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface CreatedRole {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  description: string;
  is_active: boolean;
  status: string;
  created_at?: string;
}

export async function createRole(payload: CreateRolePayload): Promise<CreatedRole> {
  return apiPost<CreatedRole>('/accounts/roles/', payload);
}

export async function fetchRoleAssignees(
  roleSlug: string,
): Promise<{ role_slug: string; users: RoleAssignee[]; total: number }> {
  return apiGet(`/accounts/roles/${roleSlug}/assignees/`);
}

export async function fetchUserPermissionInventory(
  userId: string,
): Promise<UserPermissionInventory> {
  return apiGet<UserPermissionInventory>(`/accounts/users/${userId}/permissions/`);
}

export async function grantUserPermission(
  userId: string,
  permissionCode: string,
  approvalFile: File,
): Promise<void> {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('permission_code', permissionCode);
  form.append('confirm', 'true');
  form.append('approval_email', approvalFile);
  await apiPostForm('/accounts/permissions/grant/', form);
}

export async function revokeUserPermission(
  userId: string,
  permissionCode: string,
  approvalFile: File,
): Promise<void> {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('permission_code', permissionCode);
  form.append('confirm', 'true');
  form.append('approval_email', approvalFile);
  await apiPostForm('/accounts/permissions/revoke/', form);
}

export async function deleteUserPermissionGrant(grantId: string): Promise<void> {
  await apiDelete(`/accounts/permissions/grants/${grantId}/`);
}

export async function fetchPermissionMatrix(): Promise<PermissionMatrixData> {
  return apiGet<PermissionMatrixData>('/accounts/permissions/matrix/');
}

export async function fetchPermissionMatrixAudit(limit = 50): Promise<PermissionAuditLog[]> {
  return apiGet<PermissionAuditLog[]>(`/accounts/permissions/matrix/audit/?limit=${limit}`);
}

export async function grantRolePermission(
  roleSlug: string,
  permissionCode: string,
  approvalFile: File,
): Promise<PermissionMatrixData> {
  const form = new FormData();
  form.append('permission_code', permissionCode);
  form.append('confirm', 'true');
  form.append('approval_email', approvalFile);
  return apiPostForm<PermissionMatrixData>(
    `/accounts/roles/${roleSlug}/permissions/grant/`,
    form,
  );
}

export async function revokeRolePermission(
  roleSlug: string,
  permissionCode: string,
  approvalFile: File,
): Promise<PermissionMatrixData> {
  const form = new FormData();
  form.append('permission_code', permissionCode);
  form.append('confirm', 'true');
  form.append('approval_email', approvalFile);
  return apiPostForm<PermissionMatrixData>(
    `/accounts/roles/${roleSlug}/permissions/revoke/`,
    form,
  );
}

export function buildMatrixState(
  roles: MatrixRole[],
): Record<string, Record<string, boolean>> {
  const state: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    state[role.slug] = {};
    for (const code of role.permission_codes) {
      state[role.slug][code] = true;
    }
  }
  return state;
}
