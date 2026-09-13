import { apiGet, apiPost, apiPostForm } from '@/lib/api';
import { formatAppDateTime } from '@/lib/dateUtils';

export interface ApiUserRole {
  slug: string;
  name: string;
  display_name?: string;
  assigned_at: string;
}

export interface ApiUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_number: string;
  employee_code: string;
  is_active: boolean;
  is_staff: boolean;
  is_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  roles: ApiUserRole[];
}

export interface PaginatedUsers {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiUser[];
}

export interface CreateUserPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
}

export interface AssignableRole {
  slug: string;
  name: string;
  display_name?: string;
}

export interface RoleChangeRecord {
  id: string;
  role_slug: string;
  role_name: string;
  action: 'assign' | 'revoke';
  performed_by_name: string | null;
  created_at: string;
}

export async function fetchUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
}): Promise<PaginatedUsers> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search) query.set('search', params.search);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));

  const qs = query.toString();
  return apiGet<PaginatedUsers>(`/accounts/users/${qs ? `?${qs}` : ''}`);
}

export async function fetchUser(userId: string): Promise<ApiUser> {
  return apiGet<ApiUser>(`/accounts/users/${userId}/`);
}

export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
  return apiPost<ApiUser>('/accounts/users/', payload);
}

export async function fetchAssignableRoles(): Promise<AssignableRole[]> {
  return apiGet<AssignableRole[]>('/accounts/users/assignable-roles/');
}

export async function assignUserRole(
  userId: string,
  roleSlug: string,
  approvalFile: File,
  replaceExisting = true,
): Promise<void> {
  const formData = new FormData();
  formData.append('role_slug', roleSlug);
  formData.append('confirm', 'true');
  formData.append('replace_existing', String(replaceExisting));
  formData.append('approval_email', approvalFile);

  await apiPostForm(`/accounts/users/${userId}/assign-role/`, formData);
}

export async function fetchUserRoleHistory(userId: string): Promise<RoleChangeRecord[]> {
  return apiGet<RoleChangeRecord[]>(`/accounts/users/${userId}/role-history/`);
}

export interface ResetUserPasswordResult {
  temporary_password: string;
}

export async function resetUserPassword(
  userId: string,
  payload: { confirm: boolean; password?: string },
): Promise<ResetUserPasswordResult> {
  return apiPost<ResetUserPasswordResult>(`/accounts/users/${userId}/reset-password/`, payload);
}

export function mapApiUserToListItem(user: ApiUser) {
  return {
    id: user.id,
    name: user.full_name || user.email,
    email: user.email,
    employeeId: user.employee_code || '—',
    role: user.roles[0]?.name ?? 'Unassigned',
    status: user.is_active ? ('Active' as const) : ('Inactive' as const),
    joinedDate: formatAppDateTime(user.created_at),
    lastLogin: user.last_login
      ? formatAppDateTime(user.last_login)
      : 'Never',
  };
}
