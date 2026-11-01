import { api, apiGet, apiPost, apiPostForm } from '@/lib/api';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'reopened'
  | 'closed'
  | 'cancelled';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketDepartment = 'relationship' | 'credit' | 'collection' | 'accounts' | 'general';

export type TicketLinkedType = 'lead' | 'call_log' | 'customer' | 'application' | 'loan';

export type TicketAction =
  | 'assign'
  | 'start'
  | 'hold'
  | 'resolve'
  | 'close'
  | 'reopen'
  | 'cancel'
  | 'comment';

export interface TicketUser {
  id: string;
  name: string;
  email: string;
}

export interface TicketCategory {
  id: string;
  department: TicketDepartment;
  department_display: string;
  name: string;
  description: string;
  default_priority: TicketPriority;
  sort_order: number;
  is_active: boolean;
}

export interface TicketListItem {
  id: string;
  ticket_no: string;
  subject: string;
  category: { id: string; name: string };
  department: TicketDepartment;
  department_display: string;
  priority: TicketPriority;
  priority_display: string;
  status: TicketStatus;
  status_display: string;
  raised_by: TicketUser;
  assigned_to: TicketUser | null;
  linked_type: TicketLinkedType | null;
  linked_object_id: string | null;
  linked_label: string;
  reference_text: string;
  reopen_count: number;
  resolved_at: string | null;
  auto_close_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCorrection {
  field: string;
  before: string;
  after: string;
}

export interface TicketEvent {
  id: string;
  kind: string;
  kind_display: string;
  actor: TicketUser | null;
  from_status: TicketStatus | '';
  to_status: TicketStatus;
  remark: string;
  metadata: { corrections?: TicketCorrection[]; assigned_to?: string };
  created_at: string;
}

export interface TicketComment {
  id: string;
  author: TicketUser;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  file_name: string;
  file_size: number;
  url: string;
  uploaded_by: TicketUser;
  created_at: string;
}

export interface TicketDetail extends TicketListItem {
  description: string;
  resolution_remark: string;
  resolved_by: TicketUser | null;
  closed_by: TicketUser | null;
  close_type: '' | 'confirmed' | 'auto';
  related_ticket: { id: string; ticket_no: string } | null;
  events: TicketEvent[];
  comments: TicketComment[];
  attachments: TicketAttachment[];
  allowed_actions: TicketAction[];
}

export interface TicketPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: TicketListItem[];
}

export interface TicketSummary {
  by_status: Record<TicketStatus, number>;
  by_department: { department: TicketDepartment; n: number }[];
  awaiting_my_confirmation: number;
  assigned_to_me_open?: number;
  unassigned?: number;
}

export interface TicketListParams {
  status?: string;
  department?: string;
  priority?: string;
  category?: string;
  assigned_to?: string;
  mine?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface RaiseTicketPayload {
  category: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
  linked_type?: TicketLinkedType | null;
  linked_id?: string | null;
  reference_text?: string;
  related_ticket?: string | null;
}

export const TICKET_DEPARTMENT_OPTIONS: { value: TicketDepartment; label: string }[] = [
  { value: 'relationship', label: 'Relationship (RM)' },
  { value: 'credit', label: 'Credit (CM)' },
  { value: 'collection', label: 'Collection' },
  { value: 'accounts', label: 'Accounts & Finance' },
  { value: 'general', label: 'General' },
];

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** Statuses IT Support still has to act on. */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'on_hold', 'reopened'];

const BASE = '/helpdesk/tickets/';

function toQuery(params: TicketListParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    query.set(key, value === true ? '1' : String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function fetchTicketCategories(department?: TicketDepartment): Promise<TicketCategory[]> {
  const suffix = department ? `?department=${department}` : '';
  return apiGet<TicketCategory[]>(`/helpdesk/categories/${suffix}`);
}

export function fetchTickets(params: TicketListParams = {}): Promise<TicketPage> {
  return apiGet<TicketPage>(`${BASE}${toQuery(params)}`);
}

export function fetchTicketSummary(mine = false): Promise<TicketSummary> {
  return apiGet<TicketSummary>(`${BASE}summary/${mine ? '?mine=1' : ''}`);
}

export function fetchTicket(id: string): Promise<TicketDetail> {
  return apiGet<TicketDetail>(`${BASE}${id}/`);
}

export function fetchTicketAssignees(): Promise<TicketUser[]> {
  return apiGet<TicketUser[]>(`${BASE}assignees/`);
}

export function raiseTicket(payload: RaiseTicketPayload): Promise<TicketDetail> {
  return apiPost<TicketDetail>(BASE, payload);
}

export function assignTicket(id: string, assignee: string): Promise<TicketDetail> {
  return apiPost<TicketDetail>(`${BASE}${id}/assign/`, { assignee });
}

export function startTicket(id: string): Promise<TicketDetail> {
  return apiPost<TicketDetail>(`${BASE}${id}/start/`, {});
}

export function resolveTicket(
  id: string,
  remark: string,
  corrections: TicketCorrection[] = [],
): Promise<TicketDetail> {
  return apiPost<TicketDetail>(`${BASE}${id}/resolve/`, { remark, corrections });
}

/** hold / close / reopen / cancel all take an optional or required remark. */
export function transitionTicket(
  id: string,
  action: 'hold' | 'close' | 'reopen' | 'cancel',
  remark = '',
): Promise<TicketDetail> {
  return apiPost<TicketDetail>(`${BASE}${id}/${action}/`, { remark });
}

export function addTicketComment(
  id: string,
  body: string,
  isInternal = false,
): Promise<TicketComment> {
  return apiPost<TicketComment>(`${BASE}${id}/comments/`, { body, is_internal: isInternal });
}

export function uploadTicketAttachment(id: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append('file', file);
  return apiPostForm<TicketAttachment>(`${BASE}${id}/attachments/`, form);
}

export async function downloadTicketsCsv(params: TicketListParams = {}): Promise<void> {
  const response = await api.get<Blob>(`${BASE}export/${toQuery(params)}`, {
    responseType: 'blob',
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename="([^"]+)"/.exec(disposition);
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? 'helpdesk-tickets.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** In-app route for a ticket's linked record, when the CRM has a page for it. */
export function linkedRecordPath(ticket: Pick<TicketListItem, 'linked_type' | 'linked_object_id'>) {
  if (!ticket.linked_object_id) return null;
  if (ticket.linked_type === 'lead') return `/leads/all/${ticket.linked_object_id}`;
  if (ticket.linked_type === 'customer') return `/customers/${ticket.linked_object_id}`;
  return null;
}

export const TICKET_ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.csv';
export const TICKET_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
