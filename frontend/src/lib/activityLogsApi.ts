import { apiGet, apiPost, apiDelete } from '@/lib/api';

export interface PaginatedActivityRows<T> {
  count: number;
  results: T[];
}

export interface UserActivityRow {
  id: string;
  userEmail: string;
  userName: string;
  action: string;
  description: string;
  ipAddress: string;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  userEmail: string;
  userName: string;
  action: string;
  modelName: string;
  objectId: string;
  ipAddress: string;
  createdAt: string;
}

export interface CallLogReportRow {
  id: string;
  leadId: string;
  leadCode: string;
  disposition: string;
  remarks: string;
  loggedBy: string;
  loggedByEmail: string;
  createdAt: string;
}

export interface LeadActivityReportRow {
  id: string;
  leadId: string;
  leadCode: string;
  activityType: string;
  description: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
}

export interface CollectionActivityReportRow {
  id: string;
  loanAccount: string;
  customerName: string;
  activityType: string;
  outcome: string;
  notes: string;
  nextFollowUp: string;
  performedBy: string;
  performedByEmail: string;
  performedAt: string;
}

export type ActivityLogTab =
  | 'user-activity'
  | 'audit-logs'
  | 'call-logs'
  | 'lead-activity'
  | 'collection-activity';

function buildPageQuery(page: number, pageSize: number): string {
  return `page=${page}&page_size=${pageSize}`;
}

export async function fetchUserActivityRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedActivityRows<UserActivityRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  return apiGet<PaginatedActivityRows<UserActivityRow>>(
    `/reports/activity/user/?${buildPageQuery(page, pageSize)}`,
  );
}

export async function fetchAuditLogRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedActivityRows<AuditLogRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  return apiGet<PaginatedActivityRows<AuditLogRow>>(
    `/reports/activity/audit/?${buildPageQuery(page, pageSize)}`,
  );
}

export async function fetchCallLogReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedActivityRows<CallLogReportRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  return apiGet<PaginatedActivityRows<CallLogReportRow>>(
    `/reports/activity/call-logs/?${buildPageQuery(page, pageSize)}`,
  );
}

export async function fetchLeadActivityReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedActivityRows<LeadActivityReportRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  return apiGet<PaginatedActivityRows<LeadActivityReportRow>>(
    `/reports/activity/lead/?${buildPageQuery(page, pageSize)}`,
  );
}

export async function fetchCollectionActivityReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedActivityRows<CollectionActivityReportRow>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  return apiGet<PaginatedActivityRows<CollectionActivityReportRow>>(
    `/reports/activity/collection/?${buildPageQuery(page, pageSize)}`,
  );
}

export type UserActivityActionType =
  | 'login'
  | 'logout'
  | 'session_invalidated'
  | 'export'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'upload'
  | 'grant'
  | 'revoke'
  | 'submit'
  | 'convert';

export async function logUserActivity(payload: {
  action: UserActivityActionType;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await apiPost('/audit-logs/user-activity/log/', payload);
}

export function logExportActivity(params: {
  filename: string;
  sheetName?: string;
  rowCount: number;
  module?: string;
  screen?: string;
  label?: string;
}): void {
  if (params.rowCount <= 0) return;

  const subject = resolveExportSubject(params);
  const rowLabel = params.rowCount === 1 ? '1 row' : `${params.rowCount} rows`;

  void logUserActivity({
    action: 'export',
    description: `Exported ${subject} (${rowLabel})`,
    metadata: {
      filename: params.filename,
      sheetName: params.sheetName,
      rowCount: params.rowCount,
      module: params.module,
      screen: params.screen,
      label: params.label,
      exportSubject: subject,
    },
  }).catch(() => undefined);
}

function humanizeToken(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function humanizeExportFilename(filename: string): string {
  let base = filename.replace(/\.xlsx$/i, '');
  base = base.replace(/_\d{4}-\d{2}-\d{2}(?:T[\d:.+-Z]+)?$/i, '');
  base = base.replace(/_(export|archive)$/i, '');
  return humanizeToken(base);
}

function resolveExportSubject(params: {
  filename: string;
  sheetName?: string;
  module?: string;
  screen?: string;
  label?: string;
}): string {
  if (params.label?.trim()) {
    return params.label.trim();
  }

  if (params.screen?.trim()) {
    return humanizeToken(params.screen);
  }

  const sheet = params.sheetName?.trim();
  if (sheet && sheet.toLowerCase() !== 'export') {
    return `${sheet} report`;
  }

  const fromFilename = humanizeExportFilename(params.filename);
  if (fromFilename) {
    return fromFilename;
  }

  if (params.module?.trim()) {
    return `${humanizeToken(params.module)} data`;
  }

  return 'data export';
}

export const ACTIVITY_LOG_FETCHERS = {
  'user-activity': fetchUserActivityRows,
  'audit-logs': fetchAuditLogRows,
  'call-logs': fetchCallLogReportRows,
  'lead-activity': fetchLeadActivityReportRows,
  'collection-activity': fetchCollectionActivityReportRows,
} as const;

const ACTIVITY_LOG_DELETE_TYPE: Record<ActivityLogTab, string> = {
  'user-activity': 'user',
  'audit-logs': 'audit',
  'call-logs': 'call-logs',
  'lead-activity': 'lead',
  'collection-activity': 'collection',
};

export async function deleteActivityLogRow(tab: ActivityLogTab, id: string): Promise<void> {
  const logType = ACTIVITY_LOG_DELETE_TYPE[tab];
  await apiDelete(`/reports/activity/${logType}/${id}/`);
}
