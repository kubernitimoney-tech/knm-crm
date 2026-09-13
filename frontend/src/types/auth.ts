export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_number: string;
  employee_code?: string;
  is_active?: boolean;
  is_staff: boolean;
  is_verified: boolean;
  last_login?: string | null;
  created_at?: string | null;
}

export interface AuthRole {
  slug: string;
  name: string;
  display_name?: string;
}

export interface AuthAccess {
  is_super_admin: boolean;
  is_admin: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_grant_permission: boolean;
  /** Only Super Admin may grant/revoke any `*.delete` permission. */
  can_grant_delete_permission: boolean;
  can_create_user: boolean;
  can_assign_roles: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthSession {
  user: AuthUser;
  roles: AuthRole[];
  permissions: string[];
  access: AuthAccess;
  tokens: AuthTokens;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}
