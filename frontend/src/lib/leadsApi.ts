import { AxiosError } from 'axios';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { formatCurrency, formatPersonName } from '@/lib/utils';
import type { ApiEnvelope } from '@/types/auth';
import { fetchPipelineRows, type PipelineRow } from '@/lib/pipelineApi';

export interface ApiLead {
  id: string;
  lead_id: string;
  status: string;
  status_display: string;
  close_reason: string;
  close_reason_display: string;
  category: string;
  category_display: string;
  customer: string;
  customer_name: string;
  email: string;
  mobile_number: string;
  pan_no: string;
  aadhaar_no: string;
  customer_code: string;
  customer_gender: string;
  customer_dob: string | null;
  city: string;
  state: string;
  pincode: string;
  monthly_income: string | null;
  required_amount: string | null;
  employment_type: string;
  employment_type_display: string;
  loan_purpose: string | null;
  product_name: string | null;
  assigned_rm: string | null;
  assigned_rm_name: string | null;
  assigned_rm_email: string | null;
  assigned_cm: string | null;
  assigned_cm_name: string | null;
  source: string | null;
  source_name: string | null;
  interested_product: string | null;
  product_code: string | null;
  converted_application: string | null;
  converted_at: string | null;
  application_status: string | null;
  application_status_display: string | null;
  latest_call_disposition: string | null;
  latest_call_disposition_display: string | null;
  submitted_at: string | null;
  created_at: string;
  loan_amount?: string | null;
  processing_fee?: string | null;
  roi?: string | null;
  sanction_date?: string | null;
  last_payment_date?: string | null;
}

export interface PaginatedLeads {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiLead[];
}

export interface LeadSource {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface ActiveLeadInfo {
  lead_id: string;
  status: string;
  assigned_rm_name: string | null;
  assigned_rm_email: string | null;
}

export interface CustomerLookupResult {
  exists: boolean;
  customer?: {
    id: string;
    customer_code: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile_number: string;
    pan_no: string;
    aadhaar_no: string;
    dob: string | null;
    gender: string;
  };
  active_lead?: ActiveLeadInfo | null;
  leads_created_last_hour?: number;
  can_create_lead?: boolean;
  suggested_initial_status?: string;
}

export interface LeadEmploymentInput {
  employer_name?: string;
  designation?: string;
  employment_type?: string;
  monthly_salary?: number | null;
}

export interface LeadAddressInput {
  address_type?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface CreateLeadPayload {
  first_name: string;
  last_name?: string;
  email: string;
  mobile_number: string;
  dob: string;
  gender: string;
  pan_no?: string;
  aadhaar_no?: string;
  required_amount: number;
  source?: string | null;
  interested_product?: string | null;
  loan_purpose?: string;
  employment?: LeadEmploymentInput | null;
  address?: LeadAddressInput | null;
}

export function buildCreateLeadPayload(input: {
  firstName?: string;
  lastName?: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string;
  pan?: string;
  aadhaar?: string;
  requiredAmount: string;
  source?: string;
  loanPurpose?: string;
  employment?: LeadEmploymentInput | null;
  address?: LeadAddressInput | null;
}): CreateLeadPayload {
  const emailLocal = input.email.trim().split('@')[0] || 'Customer';
  const payload: CreateLeadPayload = {
    first_name: (input.firstName?.trim() || emailLocal).slice(0, 150),
    email: input.email.trim(),
    mobile_number: input.mobile.replace(/\D/g, ''),
    dob: input.dob,
    gender: input.gender,
    required_amount: Number(input.requiredAmount),
  };

  const lastName = input.lastName?.trim();
  if (lastName) payload.last_name = lastName;

  const pan = input.pan?.trim().toUpperCase();
  if (pan) payload.pan_no = pan;

  const aadhaar = input.aadhaar?.replace(/\D/g, '');
  if (aadhaar) payload.aadhaar_no = aadhaar;

  if (input.source) payload.source = input.source;

  const loanPurpose = input.loanPurpose?.trim();
  if (loanPurpose) payload.loan_purpose = loanPurpose;

  if (input.employment?.employment_type) {
    payload.employment = {
      employer_name: input.employment.employer_name?.trim() || undefined,
      designation: input.employment.designation?.trim() || undefined,
      employment_type: input.employment.employment_type,
      monthly_salary: input.employment.monthly_salary ?? null,
    };
  }

  if (input.address) {
    const line1 = input.address.line1?.trim();
    const city = input.address.city?.trim();
    const state = input.address.state?.trim();
    const pincode = input.address.pincode?.replace(/\D/g, '');
    if (line1 || city || state || pincode) {
      payload.address = {
        address_type: input.address.address_type || 'own',
        line1: line1 || city || state || pincode || 'Address on file',
        line2: input.address.line2?.trim() || undefined,
        city: city || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
        country: input.address.country || 'India',
      };
    }
  }

  return payload;
}

export interface CallLog {
  id: string;
  lead: string;
  disposition: string;
  disposition_display: string;
  remarks: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export class DuplicateLeadError extends Error {
  active: ActiveLeadInfo | null;
  constructor(message: string, active: ActiveLeadInfo | null) {
    super(message);
    this.name = 'DuplicateLeadError';
    this.active = active;
  }
}

export async function lookupCustomer(params: {
  pan?: string;
  aadhaar?: string;
  email?: string;
  mobile?: string;
}): Promise<CustomerLookupResult> {
  const query = new URLSearchParams();
  if (params.pan) query.set('pan', params.pan);
  if (params.aadhaar) query.set('aadhaar', params.aadhaar);
  if (params.email) query.set('email', params.email);
  if (params.mobile) query.set('mobile_number', params.mobile);
  return apiGet<CustomerLookupResult>(`/leads/customer-lookup/?${query.toString()}`);
}

/** @deprecated Use lookupCustomer */
export async function lookupCustomerByPan(pan: string): Promise<CustomerLookupResult> {
  return lookupCustomer({ pan });
}

export async function fetchLeadSources(): Promise<LeadSource[]> {
  return apiGet<LeadSource[]>('/leads/sources/');
}

/** Single page of leads from GET /leads/ (server-side filters, sort, pagination). */
export async function fetchLeads(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  category?: string;
  application_status?: string;
  call_disposition?: string;
  date_from?: string;
  date_to?: string;
  ordering?: string;
}): Promise<PaginatedLeads> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.application_status) query.set('application_status', params.application_status);
  if (params?.call_disposition) query.set('call_disposition', params.call_disposition);
  if (params?.date_from) query.set('date_from', params.date_from);
  if (params?.date_to) query.set('date_to', params.date_to);
  if (params?.ordering) query.set('ordering', params.ordering);
  const qs = query.toString();
  return apiGet<PaginatedLeads>(`/leads/${qs ? `?${qs}` : ''}`);
}

export interface LeadListSummary {
  total: number;
  fresh: number;
  reloan: number;
}

/** Fresh / reloan / total counts for the active list filters (GET /leads/summary/). */
export async function fetchLeadListSummary(
  params?: Omit<NonNullable<Parameters<typeof fetchLeads>[0]>, 'page' | 'page_size' | 'ordering'>,
): Promise<LeadListSummary> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.application_status) query.set('application_status', params.application_status);
  if (params?.call_disposition) query.set('call_disposition', params.call_disposition);
  if (params?.date_from) query.set('date_from', params.date_from);
  if (params?.date_to) query.set('date_to', params.date_to);
  const qs = query.toString();
  return apiGet<LeadListSummary>(`/leads/summary/${qs ? `?${qs}` : ''}`);
}

/** Map UI table column keys to Django REST ordering query values. */
const LEAD_SORT_FIELD_MAP: Record<string, string> = {
  createdAt: 'created_at',
  leadId: 'lead_id',
  customerName: 'customer__first_name',
  pipelineStatus: 'status',
  status: 'category',
  email: 'customer__email',
  mobile: 'customer__mobile_number',
  requiredAmount: 'required_amount',
  monthlyIncome: 'required_amount',
  assignedRM: 'assigned_rm__first_name',
  assignedCM: 'assigned_cm__first_name',
  city: 'created_at',
};

export function leadSortToOrdering(
  key: string,
  direction: 'asc' | 'desc' | null,
  fallback = '-created_at',
): string {
  const field = LEAD_SORT_FIELD_MAP[key];
  if (!field || !direction) return fallback;
  return direction === 'desc' ? `-${field}` : field;
}

/** Map Fresh / Reloan pill labels to API lead status slugs. */
export function leadCategoryToApiFilter(category: string): string | undefined {
  if (category === 'Fresh') return 'fresh';
  if (category === 'Reloan') return 'reloan';
  return undefined;
}

/** Status query param for Fresh / Reloan toolbar pills (status-based, not category). */
export function leadFreshReloanPillStatusFilter(label: string): string | undefined {
  return leadCategoryToApiFilter(label);
}

/**
 * Fetch every page of leads matching the filters.
 * Used for CSV export only — prefer fetchLeads for on-screen lists.
 */
export async function fetchAllLeads(
  params?: Omit<NonNullable<Parameters<typeof fetchLeads>[0]>, 'page' | 'page_size'>,
): Promise<ApiLead[]> {
  const LEADS_PAGE_SIZE = 100;
  const all: ApiLead[] = [];
  let page = 1;
  let totalCount: number | null = null;

  while (true) {
    const res = await fetchLeads({ ...params, page, page_size: LEADS_PAGE_SIZE });
    if (totalCount === null) {
      totalCount = res.count;
    }
    all.push(...res.results);
    if (res.results.length === 0 || all.length >= totalCount) {
      break;
    }
    page += 1;
  }

  return all;
}

export class LeadRateLimitError extends Error {
  constructor(
    message: string,
    public readonly leadsCreatedLastHour?: number,
    public readonly maxPerHour?: number,
  ) {
    super(message);
    this.name = 'LeadRateLimitError';
  }
}

export async function createLead(payload: CreateLeadPayload): Promise<ApiLead> {
  try {
    return await apiPost<ApiLead>('/leads/', payload);
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 429) {
      const data = err.response.data as ApiEnvelope<unknown> & {
        errors?: {
          rate_limit?: {
            leads_created_last_hour?: number;
            max_per_hour?: number;
          };
        };
      };
      const rate = data.errors?.rate_limit;
      throw new LeadRateLimitError(
        data.message || 'Lead creation rate limit reached.',
        rate?.leads_created_last_hour,
        rate?.max_per_hour,
      );
    }
    if (err instanceof AxiosError && err.response?.status === 409) {
      const data = err.response.data as ApiEnvelope<unknown> & {
        errors?: { duplicate_lead?: ActiveLeadInfo };
      };
      const dup = data.errors?.duplicate_lead ?? null;
      throw new DuplicateLeadError(
        data.message || 'This enquiry is already in process.',
        dup,
      );
    }
    throw err;
  }
}

export async function transferLead(
  leadId: string,
  newRmId: string,
  remarks: string,
): Promise<ApiLead> {
  return apiPost<ApiLead>(`/leads/${leadId}/transfer/`, {
    new_rm: newRmId,
    remarks,
  });
}

export interface UpdateLeadPayload {
  required_amount?: number | null;
  source?: string | null;
  status?: string;
  interested_product?: string | null;
  rejection_reason?: string;
}

export async function updateLead(
  leadId: string,
  payload: UpdateLeadPayload,
): Promise<ApiLead> {
  return apiPatch<ApiLead>(`/leads/${leadId}/`, payload);
}

export async function deleteLead(leadId: string): Promise<void> {
  await apiDelete<unknown>(`/leads/${leadId}/`);
}

export async function fetchCallLogs(leadId: string): Promise<CallLog[]> {
  return apiGet<CallLog[]>(`/leads/${leadId}/call-logs/`);
}

export async function createCallLog(
  leadId: string,
  payload: { disposition: string; remarks?: string },
): Promise<CallLog> {
  return apiPost<CallLog>(`/leads/${leadId}/call-logs/`, payload);
}

export async function fetchLead(leadId: string): Promise<ApiLead> {
  return apiGet<ApiLead>(`/leads/${leadId}/`);
}

export interface ConvertLeadPayload {
  product_id: string;
  requested_amount?: number | null;
  tenure_value?: number | null;
}

export interface ConvertLeadResponse {
  lead: ApiLead;
  application: import('@/lib/applicationsApi').ApiLoanApplication;
}

export async function convertLead(
  leadId: string,
  payload: ConvertLeadPayload,
): Promise<ConvertLeadResponse> {
  return apiPost<ConvertLeadResponse>(`/leads/${leadId}/convert/`, payload);
}

const STATUS_TO_CATEGORY_LABEL: Record<string, 'Fresh' | 'Reloan'> = {
  fresh: 'Fresh',
  reloan: 'Reloan',
};

/** CRM pipeline status labels (matches backend LeadStatus display values). */
export const LEAD_PIPELINE_STATUS_OPTIONS = [
  'Fresh',
  'Reloan',
  'Busy',
  'Call Back',
  'Call Disconnected',
  'No Answer',
  'Switched Off',
  'Other',
  'Interested',
  'Document Pending',
  'Documents Received',
  'Duplicate Lead',
  'Invalid Number',
  'Not Interested',
  'Closed',
] as const;

/** Status filters on the All Leads listing page (CRM/call pipeline, then application & collection). */
export const ALL_LEADS_STATUS_FILTER_OPTIONS = [
  // Intake & call disposition lead statuses
  'Fresh',
  'Reloan',
  'Busy',
  'Call Back',
  'Interested',
  'Document Pending',
  'Documents Received',
  'Not Interested',
  'Duplicate Lead',
  'Invalid Number',
  'Loan Running',
  // Application / sanction pipeline
  'Documents Verified',
  'Approved',
  'Rejected',
  'Cancelled',
  'Disbursal Sheet Sent',
  'Disbursed',
  // Collection & closure
  'Part Payment',
  'Payday Pre-Close',
  'Settlement',
  'Closed',
] as const;

export type AllLeadsStatusFilterLabel = (typeof ALL_LEADS_STATUS_FILTER_OPTIONS)[number];

export function allLeadsStatusFilterFetchParams(filter: string): {
  status?: string;
  category?: string;
  application_status?: string;
} {
  switch (filter) {
    case 'Fresh':
      return { status: 'fresh' };
    case 'Reloan':
      return { status: 'reloan' };
    case 'Busy':
      return { status: 'busy' };
    case 'Call Back':
      return { status: 'call_back' };
    case 'Interested':
      return { status: 'interested' };
    case 'Document Pending':
      return { status: 'documents_pending' };
    case 'Documents Received':
      return { status: 'documents_received' };
    case 'Not Interested':
      return { status: 'not_interested' };
    case 'Duplicate Lead':
      return { status: 'duplicate_lead' };
    case 'Invalid Number':
      return { status: 'invalid_number' };
    case 'Loan Running':
      return { status: 'loan_running' };
    case 'Documents Verified':
      return { application_status: 'documents_verified' };
    case 'Approved':
      return { application_status: 'approved' };
    case 'Rejected':
      return { application_status: 'rejected' };
    case 'Cancelled':
      return { application_status: 'cancelled' };
    case 'Disbursal Sheet Sent':
      return { application_status: 'disbursal_sheet_sent' };
    case 'Disbursed':
      return { application_status: 'disbursed' };
    case 'Part Payment':
      return { status: 'part_payment' };
    case 'Payday Pre-Close':
      return { status: 'payday_pre_close' };
    case 'Settlement':
      return { status: 'settlement' };
    case 'Closed':
      return { status: 'closed' };
    default:
      return {};
  }
}

/** Call log disposition labels (matches backend CallDisposition display values). */
export const CALL_DISPOSITION_OPTIONS = [
  'Busy',
  'Call Back',
  'Call Disconnected',
  'Duplicate Lead',
  'Loan Running',
  'Interested',
  'Document Pending',
  'Documents Received',
  'Invalid Number',
  'No Answer',
  'Not Interested',
  'Switched Off',
  'Other',
] as const;

export const CALL_DISPOSITION_TO_VALUE: Record<(typeof CALL_DISPOSITION_OPTIONS)[number], string> = {
  Busy: 'busy',
  'Call Back': 'call_back',
  'Call Disconnected': 'call_disconnected',
  'Duplicate Lead': 'duplicate_lead',
  'Loan Running': 'loan_running',
  Interested: 'interested',
  'Document Pending': 'documents_pending',
  'Documents Received': 'documents_received',
  'Invalid Number': 'invalid_number',
  'No Answer': 'no_answer',
  'Not Interested': 'not_interested',
  'Switched Off': 'switched_off',
  Other: 'other',
};

/** Application / loan workflow statuses shown after lead conversion. */
export const LENDING_PIPELINE_STATUS_OPTIONS = [
  'Interested',
  'Document Pending',
  'Documents Received',
  'Documents Verified',
  'Approved',
  'Rejected',
  'Cancelled',
  'Disbursal Sheet Sent',
  'Disbursed',
  'Active',
  'Overdue',
  'Defaulted',
  'Closed',
] as const;

/** Call dispositions that reflect the latest contact attempt without advancing the loan pipeline. */
export const CONTACT_ATTEMPT_CALL_DISPOSITIONS = new Set([
  'call_disconnected',
  'no_answer',
  'switched_off',
  'other',
]);

/** Application stages where a recent contact-attempt call log can override the badge. */
const EARLY_APPLICATION_STATUSES = new Set([
  'interested',
  'documents_pending',
  'documents_received',
  'documents_incomplete',
  'documents_verified',
]);

/** Collection updates after disbursal — override application workflow in the status badge. */
export const COLLECTION_OVERRIDE_STATUSES = new Set([
  'part_payment',
  'payday_pre_close',
  'settlement',
]);

/** Application outcomes that should display over CRM lead status (e.g. after loan rejection). */
const APPLICATION_OUTCOME_DISPLAY_STATUSES = new Set(['rejected', 'cancelled']);

/** Terminal lead statuses shown from lead (not application workflow). */
const TERMINAL_LEAD_DISPLAY_STATUSES = new Set([
  'closed',
  'duplicate_lead',
  'invalid_number',
]);

/** Lead statuses where a rejected/cancelled application should still override the badge. */
const APPLICATION_OUTCOME_LEAD_STATUSES = new Set(['not_interested', 'closed']);

/** Lead statuses whose label should come from lead.status_display, not application workflow. */
const LEAD_STATUS_OVER_APPLICATION_DISPLAY = new Set([
  'busy',
  'call_back',
  'documents_pending',
]);

export function isCollectionLeadStatus(status: string | null | undefined): boolean {
  return Boolean(status && COLLECTION_OVERRIDE_STATUSES.has(status));
}

function formatLeadStatusWithCloseReason(lead: ApiLead): string | undefined {
  const base = lead.status_display;
  if (!base) return undefined;
  if (lead.status === 'closed' && lead.close_reason_display) {
    return `${base} (${lead.close_reason_display})`;
  }
  return base;
}

/**
 * Resolve the pipeline status badge: application workflow (e.g. Disbursed) unless
 * collection or terminal lead status should take priority. Latest call log disposition
 * (Busy, Call Back, etc.) is shown when the lead has not reached application workflow.
 */
export function resolveLeadStatusDisplay(
  lead: ApiLead | null | undefined,
  fallback = '—',
  options?: { preferLeadStatus?: boolean },
): string {
  if (!lead) return fallback;
  if (options?.preferLeadStatus) {
    const leadStatus = lead.status;
    if (
      lead.application_status &&
      APPLICATION_OUTCOME_DISPLAY_STATUSES.has(lead.application_status) &&
      leadStatus &&
      APPLICATION_OUTCOME_LEAD_STATUSES.has(leadStatus)
    ) {
      return lead.application_status_display ?? fallback;
    }
    if (leadStatus && TERMINAL_LEAD_DISPLAY_STATUSES.has(leadStatus)) {
      return formatLeadStatusWithCloseReason(lead) ?? fallback;
    }
    if (leadStatus && LEAD_STATUS_OVER_APPLICATION_DISPLAY.has(leadStatus)) {
      return formatLeadStatusWithCloseReason(lead) ?? fallback;
    }
    if (lead.latest_call_disposition_display) {
      return lead.latest_call_disposition_display;
    }
    return formatLeadStatusWithCloseReason(lead) ?? fallback;
  }
  const leadStatus = lead.status;
  if (leadStatus && COLLECTION_OVERRIDE_STATUSES.has(leadStatus)) {
    return lead.status_display ?? fallback;
  }
  if (
    lead.application_status &&
    APPLICATION_OUTCOME_DISPLAY_STATUSES.has(lead.application_status) &&
    leadStatus &&
    APPLICATION_OUTCOME_LEAD_STATUSES.has(leadStatus)
  ) {
    return lead.application_status_display ?? fallback;
  }
  if (leadStatus && TERMINAL_LEAD_DISPLAY_STATUSES.has(leadStatus)) {
    return formatLeadStatusWithCloseReason(lead) ?? fallback;
  }
  if (leadStatus && LEAD_STATUS_OVER_APPLICATION_DISPLAY.has(leadStatus)) {
    return formatLeadStatusWithCloseReason(lead) ?? fallback;
  }
  if (
    lead.latest_call_disposition &&
    CONTACT_ATTEMPT_CALL_DISPOSITIONS.has(lead.latest_call_disposition) &&
    lead.latest_call_disposition_display &&
    (!lead.application_status || EARLY_APPLICATION_STATUSES.has(lead.application_status))
  ) {
    return lead.latest_call_disposition_display;
  }
  if (lead.application_status) {
    return lead.application_status_display ?? fallback;
  }
  if (lead.latest_call_disposition_display) {
    return lead.latest_call_disposition_display;
  }
  return formatLeadStatusWithCloseReason(lead) ?? fallback;
}

export function mapApiLeadToRow(
  lead: ApiLead,
  options?: { preferLeadStatus?: boolean },
) {
  return {
    id: lead.id,
    leadId: lead.lead_id,
    customerName: lead.customer_name,
    category: STATUS_TO_CATEGORY_LABEL[lead.category] ?? 'Fresh',
    status: STATUS_TO_CATEGORY_LABEL[lead.category] ?? 'Fresh',
    pipelineStatus: resolveLeadStatusDisplay(lead, '—', options),
    assignedRM: lead.assigned_rm_name ?? '—',
    assignedRmId: lead.assigned_rm,
    assignedRmEmail: lead.assigned_rm_email ?? undefined,
    assignedCM: lead.assigned_cm_name ?? '—',
    customerId: lead.customer,
    email: lead.email,
    mobile: lead.mobile_number,
    pancard: lead.pan_no,
    monthlyIncome: lead.monthly_income ? Number(lead.monthly_income) : 0,
    requiredAmount: lead.required_amount ? Number(lead.required_amount) : 0,
    city: lead.city || '—',
    employmentType: lead.employment_type_display || lead.employment_type || '—',
    source: lead.source_name || '—',
    createdAt: lead.submitted_at ?? lead.created_at,
  };
}

export type LeadRow = ReturnType<typeof mapApiLeadToRow>;

export interface PreviousLeadRow extends LeadRow {
  loanAmount: number | null;
  processingFee: number | null;
  roi: number | null;
  sanctionDate: string | null;
  lastPaymentDate: string | null;
}

export function mapApiLeadToPreviousLeadRow(
  lead: ApiLead,
  options?: { preferLeadStatus?: boolean },
): PreviousLeadRow {
  const base = mapApiLeadToRow(lead, options);
  const parseAmount = (value: string | null | undefined) =>
    value != null && value !== '' ? Number(value) : null;

  return {
    ...base,
    loanAmount:
      parseAmount(lead.loan_amount) ??
      (base.requiredAmount && base.requiredAmount > 0 ? base.requiredAmount : null),
    processingFee: parseAmount(lead.processing_fee),
    roi: parseAmount(lead.roi),
    sanctionDate: lead.sanction_date ?? null,
    lastPaymentDate: lead.last_payment_date ?? null,
  };
}

/** Column headers for All Leads CSV export (matches the listing table). */
export const LEAD_LIST_EXPORT_HEADERS = [
  'S.No',
  'Lead ID',
  'Status',
  'Name',
  'Assigned RM',
  'Assigned CM',
  'Email',
  'Mobile No.',
  'PAN No.',
  'Monthly Income',
  'City',
  'Employment Type',
  'Source',
  'Lead Coming Date & Time',
] as const;

/** Format one lead row for CSV export using the same display rules as the table. */
export function formatLeadListExportRow(lead: LeadRow, index: number): Record<string, string | number> {
  return {
    'S.No': index + 1,
    'Lead ID': lead.leadId,
    Status: lead.pipelineStatus || '—',
    Name: formatPersonName(lead.customerName),
    'Assigned RM': formatPersonName(lead.assignedRM),
    'Assigned CM': formatPersonName(lead.assignedCM),
    Email: lead.email,
    'Mobile No.': lead.mobile,
    'PAN No.': (lead.pancard || '').toUpperCase(),
    'Monthly Income': formatCurrency(lead.monthlyIncome || 0),
    City: lead.city,
    'Employment Type': (lead.employmentType || '—').toUpperCase(),
    Source: lead.source,
    'Lead Coming Date & Time': formatAppDateTimeOrFallback(lead.createdAt),
  };
}

/** Map disbursed pipeline rows to the All Leads table (one row per disbursement). */
export function mapDisbursedPipelineRowToLeadRow(row: PipelineRow): LeadRow {
  return {
    id: row.id,
    leadId: row.leadId,
    customerName: row.customerName,
    category: 'Fresh',
    status: 'Fresh',
    pipelineStatus: row.status || 'Disbursed',
    assignedRM: '—',
    assignedRmId: null,
    assignedRmEmail: undefined,
    assignedCM: row.assignedCM || '—',
    customerId: row.customerId,
    email: row.email,
    mobile: row.mobile,
    pancard: row.pancard,
    monthlyIncome: row.monthlyIncome ?? 0,
    requiredAmount: row.loanAmount ?? 0,
    city: '—',
    employmentType: '—',
    source: '—',
    createdAt: row.date,
  };
}

export async function fetchDisbursedLeadRows(): Promise<LeadRow[]> {
  const rows = await fetchPipelineRows('disbursed');
  return rows.map(mapDisbursedPipelineRowToLeadRow);
}
