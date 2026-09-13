import { apiGet, apiPost, ApiRequestError } from '@/lib/api';

export interface ApiApplicationDecision {
  id: string;
  decision: 'approved' | 'rejected';
  decided_by: string | null;
  decided_by_email: string | null;
  decided_by_name: string | null;
  approved_amount: string | null;
  approved_tenure_value: number | null;
  interest_rate: string | null;
  processing_fee: string | null;
  rejection_reason: string;
  remarks: string;
  sanction_details?: Record<string, unknown>;
  decided_at: string;
}

export interface ApiLoanApplication {
  id: string;
  application_number: string;
  customer: string;
  customer_name: string;
  lead: string | null;
  product: string;
  product_code: string;
  product_name: string;
  branch: string | null;
  requested_amount: string;
  approved_amount: string | null;
  tenure_value: number | null;
  tenure_unit: string;
  purpose: string;
  status: string;
  status_display: string;
  submitted_at: string | null;
  decided_at: string | null;
  latest_decision: ApiApplicationDecision | null;
  disbursal_sheet_details?: Record<string, unknown>;
  disbursal_sheet_sent_at?: string | null;
  created_at: string;
}

export interface PaginatedApplications {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiLoanApplication[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function resolveLoanProductLabel(
  productId: string,
  products: ApiLoanProduct[],
  fallbacks?: { productName?: string; product?: ApiLoanProduct | null },
): string {
  if (!productId.trim()) return '';
  const matched = products.find((item) => item.id === productId);
  if (matched) {
    return matched.product_name || matched.product_code || 'Loan product';
  }
  const fallbackName = fallbacks?.productName?.trim();
  if (fallbackName && !isUuid(fallbackName)) {
    return fallbackName;
  }
  if (fallbacks?.product?.product_name) {
    return fallbacks.product.product_name;
  }
  if (fallbacks?.product?.product_code) {
    return fallbacks.product.product_code;
  }
  return 'Loan product';
}

export interface ApiLoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  min_amount: string;
  max_amount: string;
  min_tenure: number;
  max_tenure: number;
  tenure_unit: string;
  interest_rate: string;
  interest_type: string;
  processing_fee_type: string;
  processing_fee: string;
  processing_fee_percentage: string;
  gst_percentage: string;
}

export interface ApiApplicationDocument {
  id: string;
  document_type: string;
  document_type_code: string;
  title: string;
  is_verified: boolean;
  created_at: string;
  versions: Array<{
    id: string;
    file_name: string;
    file: string | null;
    created_at: string;
  }>;
}

export async function fetchProducts(): Promise<ApiLoanProduct[]> {
  return apiGet<ApiLoanProduct[]>('/applications/products/');
}

export async function fetchApplications(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  lead?: string;
  customer?: string;
}): Promise<PaginatedApplications> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.status) query.set('status', params.status);
  if (params?.lead) query.set('lead', params.lead);
  if (params?.customer) query.set('customer', params.customer);
  const qs = query.toString();
  return apiGet<PaginatedApplications>(`/applications/applications/${qs ? `?${qs}` : ''}`);
}

export async function fetchApplication(applicationId: string): Promise<ApiLoanApplication> {
  return apiGet<ApiLoanApplication>(`/applications/applications/${applicationId}/`);
}

export async function submitApplication(applicationId: string): Promise<ApiLoanApplication> {
  return apiPost<ApiLoanApplication>(`/applications/applications/${applicationId}/submit/`);
}

export async function decideApplication(
  applicationId: string,
  payload: {
    decision: 'approved' | 'rejected';
    approved_amount?: string | number;
    approved_tenure_value?: number;
    interest_rate?: string | number;
    processing_fee?: string | number;
    rejection_reason?: string;
    remarks?: string;
    sanction_details?: Record<string, unknown>;
  },
): Promise<ApiLoanApplication> {
  return apiPost<ApiLoanApplication>(`/applications/applications/${applicationId}/decide/`, payload);
}

export async function sendSanctionApprovedEmail(applicationId: string): Promise<void> {
  await apiPost(`/applications/applications/${applicationId}/send-sanction-email/`);
}

export async function submitDisbursalSheet(
  applicationId: string,
  payload: Record<string, unknown>,
): Promise<ApiLoanApplication> {
  return apiPost<ApiLoanApplication>(
    `/applications/applications/${applicationId}/submit-disbursal-sheet/`,
    payload,
  );
}

export async function createLoanFromApplication(applicationId: string): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>(
    `/applications/applications/${applicationId}/create-loan/`,
  );
}

export async function fetchLoanForApplication(applicationId: string): Promise<ApiLoanFromApplication | null> {
  try {
    return await apiGet<ApiLoanFromApplication>(`/applications/applications/${applicationId}/loan/`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

/** Loan payload returned from application-scoped loan endpoints. */
export interface ApiLoanFromApplication {
  id: string;
  loan_account_number: string;
  application: string;
  principal_amount: string;
  disbursed_at: string | null;
  status: string;
}

export async function fetchApplicationDocuments(
  applicationId: string,
): Promise<ApiApplicationDocument[]> {
  return apiGet<ApiApplicationDocument[]>(
    `/documents/applications/${applicationId}/documents/`,
  );
}

export async function uploadApplicationDocument(
  applicationId: string,
  payload: { documentType: string; file: File; title?: string },
): Promise<{ version_id: string; file_name: string }> {
  const formData = new FormData();
  formData.append('document_type', payload.documentType);
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  const { apiPostForm } = await import('@/lib/api');
  return apiPostForm(`/documents/upload/${applicationId}/`, formData);
}
