import type { ApiLead } from '@/lib/leadsApi';
import type { CustomerProfile } from '@/lib/customersApi';
import { mapEmploymentTypeFromApi } from '@/constants/employmentTypes';
import { normalizeLoanPurpose } from '@/constants/loanPurposes';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { formatAmount } from '@/lib/utils';
import { computeCustomerLeadStatCounts } from '@/lib/customerLeadStatsUtils';

export interface CustomerViewModel {
  id: string;
  leadId: string;
  name: string;
  code: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string;
  pan: string;
  aadhaar: string;
  avatar: string;
  loanAppliedCount: number;
  loanDisbursedCount: number;
  loanRejectedCount: number;
  loanInProgressCount: number;
  leadStatus: string;
  customerStatus: 'Active' | 'Inactive';
  activeLeadUuid: string | null;
  loanDetails: {
    loanRequired: string;
    monthlyIncome: string;
    employmentType: string;
    source: string;
    state: string;
    city: string;
    pincode: string;
    loanPurpose: string;
    assignedRM: string;
    assignedCM: string;
    appliedOn: string;
  };
  timeline: Array<{
    title: string;
    caller: string;
    datetime: string;
    body: string;
  }>;
}

export function formatGender(value: string | undefined | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDisplayAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isNaN(num)) {
    return formatAmount(num);
  }
  return String(value);
}

function formatEmploymentType(lead: ApiLead | null | undefined): string {
  if (!lead) return '—';
  return lead.employment_type_display || formatGender(lead.employment_type) || '—';
}

export function buildLoanDetailsFromLead(
  lead: ApiLead | null | undefined,
): CustomerViewModel['loanDetails'] {
  if (!lead) {
    return {
      loanRequired: '—',
      monthlyIncome: '—',
      employmentType: '—',
      source: '—',
      state: '—',
      city: '—',
      pincode: '—',
      loanPurpose: '—',
      assignedRM: '—',
      assignedCM: '—',
      appliedOn: '—',
    };
  }

  return {
    loanRequired: formatDisplayAmount(lead.required_amount),
    monthlyIncome: formatDisplayAmount(lead.monthly_income),
    employmentType: formatEmploymentType(lead),
    source: lead.source_name ?? '—',
    state: lead.state || '—',
    city: lead.city || '—',
    pincode: lead.pincode || '—',
    loanPurpose: lead.loan_purpose
      ? normalizeLoanPurpose(lead.loan_purpose)
      : lead.product_name ?? '—',
    assignedRM: lead.assigned_rm_name ?? '—',
    assignedCM: lead.assigned_cm_name ?? '—',
    appliedOn: formatAppDateTimeOrFallback(lead.created_at),
  };
}

const GENDER_AVATAR_URL: Record<'male' | 'female', string> = {
  male: '/avatars/male.png',
  female: '/avatars/female.png',
};

function normalizeGender(gender: string | undefined | null): 'male' | 'female' | null {
  const normalized = (gender ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  return null;
}

/** Avatar from local public images — uses gender when available. */
export function getCustomerAvatarUrl(
  gender: string | undefined | null,
  _seed?: string,
): string {
  const genderKey = normalizeGender(gender);
  if (genderKey) return GENDER_AVATAR_URL[genderKey];
  return GENDER_AVATAR_URL.male;
}

export function parseAddress(address: string | undefined | null) {
  if (!address?.trim()) {
    return { city: '—', state: '—', pincode: '—' };
  }
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[parts.length - 3] || '—',
      state: parts[parts.length - 2] || '—',
      pincode: parts[parts.length - 1] || '—',
    };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1], pincode: '—' };
  }
  return { city: parts[0] || '—', state: '—', pincode: '—' };
}

export function mapProfileToViewModel(
  profile: CustomerProfile,
  customerId: string,
): CustomerViewModel {
  const { customer, active_lead, call_logs, lead_stats, leads } = profile;
  const name = `${customer.first_name} ${customer.last_name}`.trim().toUpperCase() || '—';
  const loanDetails = buildLoanDetailsFromLead(active_lead);
  const leadStatCounts = computeCustomerLeadStatCounts(lead_stats, leads);

  if (customer.monthly_income != null && customer.monthly_income !== '') {
    loanDetails.monthlyIncome = formatDisplayAmount(customer.monthly_income);
  }
  if (customer.employment_type) {
    loanDetails.employmentType = mapEmploymentTypeFromApi(customer.employment_type);
  }
  if (customer.city) {
    loanDetails.city = customer.city;
  }
  if (customer.state) {
    loanDetails.state = customer.state;
  }
  if (customer.pincode) {
    loanDetails.pincode = customer.pincode;
  }

  return {
    id: customerId,
    leadId: active_lead?.lead_id ?? '—',
    name,
    code: customer.customer_code,
    email: customer.email || '—',
    mobile: customer.mobile_number || '—',
    dob: formatAppDateOrFallback(customer.dob),
    gender: formatGender(customer.gender),
    pan: customer.pan_no || '—',
    aadhaar: customer.aadhaar_no || '—',
    avatar: getCustomerAvatarUrl(customer.gender),
    loanAppliedCount: leadStatCounts.applied,
    loanDisbursedCount: leadStatCounts.disbursed,
    loanRejectedCount: leadStatCounts.rejected,
    loanInProgressCount: leadStatCounts.inProcess,
    leadStatus: active_lead?.status_display ?? 'No Active Lead',
    customerStatus: customer.customer_status === 'Inactive' ? 'Inactive' : 'Active',
    activeLeadUuid: active_lead?.id ?? null,
    loanDetails,
    timeline: call_logs.map((log) => ({
      title: log.disposition_display,
      caller: log.created_by_name || 'System',
      datetime: formatAppDateTimeOrFallback(log.created_at, ''),
      body: log.remarks || '—',
    })),
  };
}

export const DETAIL_TAB_ITEMS = [
  { value: 'customer', label: 'Customer Info' },
  { value: 'sanction', label: 'Sanction' },
  { value: 'penny', label: 'Penny Drop' },
  { value: 'disbursed', label: 'Disbursal' },
  { value: 'collection', label: 'Collection' },
  { value: 'recovery', label: 'Recovery Approval' },
  { value: 'refund', label: 'Comms Refund' },
] as const;

/** Tab labels for the Lead Details page (distinct from customer profile tabs). */
export const LEAD_DETAIL_TAB_ITEMS = [
  { value: 'customer', label: 'Customer' },
  { value: 'sanction', label: 'Sanction' },
  { value: 'penny', label: 'Penny Drop' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'collection', label: 'Collection' },
  { value: 'recovery', label: 'Recovery Approval' },
  { value: 'communication', label: 'Communication' },
  { value: 'refund', label: 'Refund' },
] as const;
