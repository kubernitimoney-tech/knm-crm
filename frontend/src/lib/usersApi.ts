import { apiGet, apiPatch, apiPost, apiPostForm, apiDelete } from '@/lib/api';
import { formatAppDateTime } from '@/lib/dateUtils';

export interface ApiUserRole {
  slug: string;
  name: string;
  display_name?: string;
  assigned_at: string;
}

export type UserApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApiUserApproval {
  status: UserApprovalStatus;
  status_display: string;
  request_remarks: string;
  attachment_name: string;
  /** Signed, expiring link — only present on the user detail endpoint. */
  attachment_url: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approver_remarks: string;
}

export interface ApiUserBranch {
  id: string;
  code: string;
  name: string;
}

export interface ApiUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  display_name?: string;
  mobile_number: string;
  branch: ApiUserBranch | null;
  address: string;
  employee_code: string;
  is_active: boolean;
  is_staff: boolean;
  is_verified: boolean;
  must_change_password: boolean;
  last_login: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
  roles: ApiUserRole[];
  approval: ApiUserApproval | null;
}

export interface PaginatedUsers {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiUser[];
}

export interface CreateUserPayload {
  email: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  display_name?: string;
  /** Blank → the server generates a temporary password and returns it once. */
  password?: string;
  mobile_number: string;
  branch: string;
  address?: string;
  role_slug?: string;
  attachment: File;
  request_remarks: string;
}

export type CreatedUser = ApiUser & { temporary_password: string | null };

export interface UpdateUserPayload {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  display_name?: string;
  mobile_number?: string;
  branch?: string;
  address?: string;
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
  approval_status?: UserApprovalStatus;
}): Promise<PaginatedUsers> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search) query.set('search', params.search);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
  if (params?.approval_status) query.set('approval__status', params.approval_status);

  const qs = query.toString();
  return apiGet<PaginatedUsers>(`/accounts/users/${qs ? `?${qs}` : ''}`);
}

export async function fetchUser(userId: string): Promise<ApiUser> {
  return apiGet<ApiUser>(`/accounts/users/${userId}/`);
}

export async function createUser(payload: CreateUserPayload): Promise<CreatedUser> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value instanceof File ? value : String(value));
  });
  return apiPostForm<CreatedUser>('/accounts/users/', formData);
}

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<ApiUser> {
  return apiPatch<ApiUser>(`/accounts/users/${userId}/`, payload);
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiDelete(`/accounts/users/${userId}/`);
}

export async function suggestUsername(email: string): Promise<string> {
  const data = await apiGet<{ username: string }>(
    `/accounts/users/username-suggestion/?email=${encodeURIComponent(email)}`,
  );
  return data.username;
}

export async function approveUser(userId: string, remarks = ''): Promise<ApiUser> {
  return apiPost<ApiUser>(`/accounts/users/${userId}/approve/`, { remarks });
}

export async function rejectUser(userId: string, remarks: string): Promise<ApiUser> {
  return apiPost<ApiUser>(`/accounts/users/${userId}/reject/`, { remarks });
}

export async function resubmitUserApproval(
  userId: string,
  attachment: File,
  requestRemarks: string,
): Promise<ApiUser> {
  const formData = new FormData();
  formData.append('attachment', attachment);
  formData.append('request_remarks', requestRemarks);
  return apiPostForm<ApiUser>(`/accounts/users/${userId}/resubmit-approval/`, formData);
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

export type UserListStatus = 'Active' | 'Inactive' | 'Pending Approval' | 'Rejected';

export function userListStatus(user: Pick<ApiUser, 'is_active' | 'approval'>): UserListStatus {
  if (user.approval?.status === 'pending') return 'Pending Approval';
  if (user.approval?.status === 'rejected') return 'Rejected';
  return user.is_active ? 'Active' : 'Inactive';
}

export function mapApiUserToListItem(user: ApiUser) {
  return {
    id: user.id,
    name: user.full_name || user.email,
    email: user.email,
    username: user.username,
    role: user.roles[0]?.name ?? 'Unassigned',
    status: userListStatus(user),
    joinedDate: formatAppDateTime(user.joined_at),
    lastLogin: user.last_login
      ? formatAppDateTime(user.last_login)
      : 'Never',
  };
}

export type UserListItem = ReturnType<typeof mapApiUserToListItem>;
