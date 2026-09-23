import { fetchApplications } from '@/lib/applicationsApi';
import { fetchLeads } from '@/lib/leadsApi';
import { formatRate } from '@/lib/utils';
import type { SanctionLead } from '@/types';

export type PipelineStage =
  | 'sanction-approved'
  | 'sanction-pending'
  | 'sanction-rejected'
  | 'enach'
  | 'disbursal-sheet'
  | 'disbursed'
  | 'cash-pending'
  | 'part-payment'
  | 'closed'
  | 'settlement'
  | 'red-flag';

export type PipelineRow = SanctionLead & {
  customerId: string;
  adminFees?: number;
  enachStatus?: 'Registered' | 'Pending' | 'Failed';
  bankName?: string;
  accountNumber?: string;
};

const STAGE_APPLICATION_STATUS: Partial<Record<PipelineStage, string>> = {};

const SANCTION_PIPELINE_STAGES = new Set<PipelineStage>([
  'sanction-pending',
  'sanction-approved',
  'sanction-rejected',
]);

const APPLICATION_PIPELINE_STAGES = new Set<PipelineStage>([
  ...SANCTION_PIPELINE_STAGES,
  'enach',
  'disbursal-sheet',
  'disbursed',
]);

const LOAN_PIPELINE_STAGES = new Set<PipelineStage>([
  'cash-pending',
  'part-payment',
  'closed',
  'settlement',
]);

interface ApiApplicationPipelineRow {
  id: string;
  application_id: string;
  lead_id: string;
  customer_name: string;
  branch: string;
  assigned_cm: string;
  email: string;
  mobile: string;
  pancard: string;
  loan_amount: string | number;
  tenure: number;
  roi: string | number;
  repay_date: string;
  processing_fee: string | number;
  monthly_income: string | number;
  cibil: number;
  status: string;
  date: string;
  rejection_reason?: string;
  customer_id: string;
  account_no?: string;
  ifsc_code?: string;
  loan_no?: string;
  loan_account?: string;
  disbursed_amount?: string | number;
  loan_type?: string;
  payment_amount?: string | number;
  payment_mode?: string;
  payment_date?: string;
  ref_no?: string;
  discount_amt?: string | number;
  settled_amount?: string | number;
  bank_name?: string;
  enach_status?: string;
}

function mapApiPipelineRow(row: ApiApplicationPipelineRow): PipelineRow {
  return {
    id: row.id,
    leadId: row.lead_id,
    customerName: row.customer_name,
    branch: row.branch,
    assignedCM: row.assigned_cm,
    email: row.email,
    mobile: row.mobile,
    pancard: row.pancard,
    loanAmount: Number(row.loan_amount ?? 0),
    tenure: row.tenure ?? 0,
    roi: Number(formatRate(row.roi ?? 0)),
    repayDate: row.repay_date,
    processingFee: Number(row.processing_fee ?? 0),
    monthlyIncome: Number(row.monthly_income ?? 0),
    cibil: Number(row.cibil ?? 0),
    status: row.status,
    date: row.date,
    rejectionReason: row.rejection_reason,
    customerId: row.customer_id,
    accountNo: row.account_no ?? '',
    ifscCode: row.ifsc_code ?? '',
    loanNo: row.loan_no ?? '',
    loanAccount: row.loan_account ?? '',
    disbursedAmount: Number(row.disbursed_amount ?? 0),
    loanType: row.loan_type ?? '',
    paymentAmount: Number(row.payment_amount ?? 0),
    paymentMode: row.payment_mode ?? '',
    paymentDate: row.payment_date ?? '',
    refNo: row.ref_no ?? '',
    discountAmt: Number(row.discount_amt ?? 0),
    settledAmount: Number(row.settled_amount ?? 0),
    bankName: row.bank_name ?? '',
    accountNumber: row.account_no ?? '',
    enachStatus: (row.enach_status as PipelineRow['enachStatus']) ?? 'Pending',
  };
}

async function fetchLoanPipelineRows(stage: PipelineStage): Promise<PipelineRow[]> {
  const { apiGet } = await import('@/lib/api');
  const rows = await apiGet<ApiApplicationPipelineRow[]>(`/loans/pipeline/?stage=${stage}`);
  return rows.map(mapApiPipelineRow);
}

async function fetchApplicationPipelineRows(stage: PipelineStage): Promise<PipelineRow[]> {
  const { apiGet } = await import('@/lib/api');
  const rows = await apiGet<ApiApplicationPipelineRow[]>(`/applications/pipeline/?stage=${stage}`);
  return rows.map(mapApiPipelineRow);
}

function mapApplicationToPipelineRow(
  app: Awaited<ReturnType<typeof fetchApplications>>['results'][number],
): PipelineRow {
  const decision = app.latest_decision;
  return {
    id: app.id,
    leadId: app.application_number,
    customerName: app.customer_name,
    branch: app.branch ?? '—',
    assignedCM: '—',
    email: '—',
    mobile: '—',
    pancard: '—',
    loanAmount: Number(decision?.approved_amount ?? app.requested_amount ?? 0),
    tenure: app.tenure_value ?? 0,
    roi: Number(formatRate(decision?.interest_rate ?? 0)),
    repayDate: app.decided_at ?? app.submitted_at ?? app.created_at,
    processingFee: Number(decision?.processing_fee ?? 0),
    monthlyIncome: 0,
    cibil: 0,
    status: app.status_display,
    date: app.created_at,
    rejectionReason: decision?.rejection_reason,
    customerId: app.customer,
  };
}

export async function fetchPipelineRows(stage: PipelineStage): Promise<PipelineRow[]> {
  if (APPLICATION_PIPELINE_STAGES.has(stage)) {
    return fetchApplicationPipelineRows(stage);
  }

  if (LOAN_PIPELINE_STAGES.has(stage)) {
    return fetchLoanPipelineRows(stage);
  }

  const applicationStatus = STAGE_APPLICATION_STATUS[stage];
  if (applicationStatus) {
    const apps = await fetchApplications({ status: applicationStatus, page_size: 100 });
    return apps.results.map(mapApplicationToPipelineRow);
  }

  if (stage === 'red-flag') {
    const leads = await fetchLeads({
      page_size: 100,
      status: 'not_interested',
    });
    return leads.results.map((lead) => ({
      id: lead.id,
      leadId: lead.lead_id,
      customerName: lead.customer_name,
      branch: '—',
      assignedCM: lead.assigned_cm_name ?? '—',
      email: lead.email,
      mobile: lead.mobile_number,
      pancard: lead.pan_no,
      loanAmount: Number(lead.required_amount ?? 0),
      tenure: 0,
      roi: 0,
      repayDate: lead.created_at,
      processingFee: 0,
      monthlyIncome: Number(lead.monthly_income ?? 0),
      cibil: 0,
      status: lead.status_display,
      date: lead.created_at,
      customerId: lead.customer,
    }));
  }

  return [];
}

export interface EsignRow {
  id: string;
  leadUuid: string;
  customerId: string;
  leadId: string;
  name: string;
  email: string;
  mob: string;
  loanAmt: string;
  requestedBy: string;
  status: string;
  resend: boolean;
  date: string;
}

export async function fetchEsignRows(): Promise<EsignRow[]> {
  try {
    const { apiGet } = await import('@/lib/api');
    return apiGet<EsignRow[]>('/leads/esign-requests/');
  } catch {
    return [];
  }
}

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  designation: string;
  assignedCmIds?: string[];
  assignedRmIds?: string[];
  status: boolean;
}

export async function fetchAssignmentRoster(type: 'rm' | 'cm'): Promise<RosterMember[]> {
  const { apiGet } = await import('@/lib/api');
  const roster = await apiGet<Array<{ id: string; name: string; email: string; active_leads?: number }>>(
    `/leads/assignment-roster/?type=${type}`,
  );
  return roster.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    designation: type === 'rm' ? 'Relationship Manager' : 'Collection Manager',
    status: true,
  }));
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

export async function fetchNotifications(): Promise<NotificationListResponse> {
  const { apiGet } = await import('@/lib/api');
  return apiGet<NotificationListResponse>('/notifications/');
}

export async function fetchNotificationUnreadCount(): Promise<number> {
  const { apiGet } = await import('@/lib/api');
  const data = await apiGet<{ unread_count: number }>('/notifications/unread-count/');
  return data.unread_count;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { apiPost } = await import('@/lib/api');
  return apiPost<NotificationItem>(`/notifications/${id}/read/`);
}

export async function markAllNotificationsRead(): Promise<number> {
  const { apiPost } = await import('@/lib/api');
  const data = await apiPost<{ updated: number }>('/notifications/read-all/');
  return data.updated;
}
