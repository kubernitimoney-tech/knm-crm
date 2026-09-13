import { apiGet, apiPatch } from '@/lib/api';
import type { ApiLead, CallLog } from '@/lib/leadsApi';

export interface ApiCustomer {
  id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  gender: string;
  dob: string | null;
  document_type?: string;
  pan_no: string;
  aadhaar_no: string;
  occupation?: string;
  monthly_income: string | number | null;
  employment_type?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  customer_status?: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface UpdateCustomerProfilePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  gender?: string;
  dob?: string | null;
  pan_no?: string;
  aadhaar_no?: string;
  monthly_income?: number | null;
  employment_type?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface CustomerLeadStats {
  applied: number;
  disbursed: number;
  rejected: number;
  others?: number;
  in_progress?: number;
}

export interface CustomerProfile {
  customer: ApiCustomer;
  leads: ApiLead[];
  active_lead: ApiLead | null;
  call_logs: CallLog[];
  lead_stats: CustomerLeadStats;
}

export async function fetchCustomer(customerId: string): Promise<ApiCustomer> {
  return apiGet<ApiCustomer>(`/customers/${customerId}/`);
}

export async function fetchCustomerProfile(
  customerId: string,
  focusLeadId?: string,
): Promise<CustomerProfile> {
  const query = focusLeadId ? `?lead=${encodeURIComponent(focusLeadId)}` : '';
  return apiGet<CustomerProfile>(`/customers/${customerId}/profile/${query}`);
}

export async function updateCustomerProfile(
  customerId: string,
  payload: UpdateCustomerProfilePayload,
  focusLeadId?: string,
): Promise<CustomerProfile> {
  const query = focusLeadId ? `?lead=${encodeURIComponent(focusLeadId)}` : '';
  return apiPatch<CustomerProfile>(`/customers/${customerId}/profile/${query}`, payload);
}
