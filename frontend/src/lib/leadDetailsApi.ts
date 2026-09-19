import { apiDelete, apiGet, apiPatch, apiPatchForm, apiPost, apiPostForm, getStoredTokens } from '@/lib/api';
import { formatRate } from '@/lib/utils';
import {
  mapAddressTypeFromApi,
  mapAddressTypeToApi,
} from '@/constants/addressTypes';
import {
  decideApplication,
  fetchApplication,
  fetchProducts,
  submitDisbursalSheet,
  type ApiLoanProduct,
} from '@/lib/applicationsApi';
import {
  disburseLoan,
  fetchLoanRepayments,
  recordLoanRepayment,
  updateLoanRepayment,
  deleteLoanRepayment,
  updateLoanDisbursement,
} from '@/lib/loansApi';
import {
  ensureLeadApplication,
  ensureLoan,
  getLeadApplication,
  getLoanForApplication,
  submitApplicationIfNeeded,
} from '@/lib/lendingContext';
import {
  normalizeRemarkCategoryForForm,
  normalizeRemarkFollowUpDateForForm,
  normalizeRemarkPriorityForForm,
  normalizeCollectionModeForForm,
  normalizeCollectionStatusForForm,
  mapCollectionStatusToApi,
  normalizeCollectionSourceForForm,
} from '@/features/leads/components/leadDisbursalConstants';
import { parseIsoDate } from '@/lib/dateUtils';
import { fetchLead } from '@/lib/leadsApi';
import { normalizeLoanPurpose } from '@/constants/loanPurposes';
import {
  computeSanctionRepaymentTenureDays,
  resolveRepaymentTenureLimits,
  validateSanctionRepaymentDate,
} from '@/features/leads/components/leadSanctionConstants';
import { fetchBankHolidayLabelMap } from '@/lib/bankHolidaysApi';

export type EntryStatus = 'verified' | 'unverified' | 'incomplete';

export interface ApiLeadDocument {
  id: string;
  document_type: string;
  document_type_display: string;
  file_name: string;
  file_url: string | null;
  password: string;
  status: EntryStatus;
  created_at: string;
}

export interface ApiLeadAddress {
  id: string;
  address_type: string;
  address_type_display: string;
  pincode: string;
  state: string;
  city: string;
  address: string;
  status: EntryStatus;
  created_at: string;
}

export interface ApiLeadCompany {
  id: string;
  company_name: string;
  company_address: string;
  status: EntryStatus;
  created_at: string;
}

export interface ApiLeadReference {
  id: string;
  relation: string;
  relation_display: string;
  reference_name: string;
  reference_mobile: string;
  status: EntryStatus;
  created_at: string;
}

export interface ApiLeadEsignRequest {
  id: string;
  status: 'pending' | 'sent' | 'signed' | 'expired';
  status_display: string;
  requested_by_name: string;
  documents: string;
  requested_on: string;
  signed_on: string;
  signed_file_url: string | null;
  sign_type: 'aadhaar' | 'electronic';
  request_url?: string | null;
  review_url?: string | null;
  provider_request_id?: string | null;
  email_sent?: boolean | null;
  email_error?: string | null;
}

export interface ApiLeadVideoKycRequest {
  id: string;
  status: 'pending' | 'sent' | 'completed' | 'expired';
  status_display: string;
  requested_by_name: string;
  video: string;
  requested_on: string;
  signed_on: string;
  recording_file_url: string | null;
  selfie_file_url: string | null;
  email_sent: boolean;
  sms_sent: boolean;
  request_url?: string | null;
  provider_request_id?: string | null;
}

export interface ApiLeadVideoKycGeolocation {
  latitude: number | null;
  longitude: number | null;
  address: string;
}

export interface ApiLeadVideoKycDetail {
  id: string;
  status: ApiLeadVideoKycRequest['status'];
  customer_name: string;
  customer_email: string;
  approval_status: string;
  ids_found: {
    video: boolean;
    selfie: boolean;
    aadhaar: boolean;
    pan: boolean;
  };
  date_time: string;
  video_details: {
    geolocation: ApiLeadVideoKycGeolocation;
    recording_file_url: string | null;
    selfie_file_url: string | null;
  };
  aadhaar_details: Record<string, string>;
  pan_details: Record<string, string>;
}

export interface ApiLeadEmployment {
  id: string;
  employer_name: string;
  designation: string;
  employment_type: string;
  employment_type_display: string;
  monthly_salary: string;
  experience_months: number;
  is_current: boolean;
  created_at: string;
}

export interface ApiStatusHistoryEntry {
  id: string;
  from_status: string;
  from_status_display: string;
  to_status: string;
  to_status_display: string;
  changed_by_name: string;
  remarks: string;
  changed_at: string;
}

export interface ApiLeadStatusHistories {
  lead: ApiStatusHistoryEntry[];
  application: ApiStatusHistoryEntry[];
  loan: ApiStatusHistoryEntry[];
}

export async function fetchLeadStatusHistories(leadId: string): Promise<ApiLeadStatusHistories> {
  const response = await apiGet<ApiLeadStatusHistories>(`/leads/${leadId}/status-histories/`);
  return response ?? { lead: [], application: [], loan: [] };
}

const DOCUMENT_TYPE_TO_API: Record<string, string> = {
  'Aadhaar Card': 'aadhaar',
  'PAN Card': 'pan',
  'Cibil Report': 'cibil_report',
  'Bank Statement': 'bank_statement',
  'Selfie': 'photograph',
  'Salary Slip': 'salary_slip',
  'ID Card': 'id_card',
  'Cheque': 'cheque',
  'Electricity Bill': 'electricity_bill',
  'Mobile Bill': 'mobile_bill',
  'Others': 'others',
};

const DOCUMENT_TYPE_FROM_API: Record<string, string> = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_TO_API).map(([label, code]) => [code, label]),
);

const RELATION_TO_API: Record<string, string> = {
  Father: 'father',
  Mother: 'mother',
  Brother: 'brother',
  Sister: 'sister',
  Spouse: 'spouse',
  Friend: 'friend',
  Colleague: 'colleague',
  Other: 'other',
};

const RELATION_FROM_API: Record<string, string> = Object.fromEntries(
  Object.entries(RELATION_TO_API).map(([label, code]) => [code, label]),
);

export function mapDocumentTypeToApi(label: string): string {
  return DOCUMENT_TYPE_TO_API[label] ?? label.toLowerCase().replace(/\s+/g, '_');
}

async function fetchOptionalList<T>(fetcher: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fetcher();
  } catch {
    return [];
  }
}

export function mapDocumentTypeFromApi(code: string): string {
  return DOCUMENT_TYPE_FROM_API[code] ?? code;
}

export { mapAddressTypeFromApi, mapAddressTypeToApi } from '@/constants/addressTypes';

export function mapRelationToApi(label: string): string {
  return RELATION_TO_API[label] ?? label.toLowerCase();
}

export function mapRelationFromApi(code: string): string {
  return RELATION_FROM_API[code] ?? code;
}

export async function fetchLeadDocuments(leadId: string): Promise<ApiLeadDocument[]> {
  return fetchOptionalList(() =>
    apiGet<ApiLeadDocument[]>(`/leads/${leadId}/documents/`),
  );
}

export async function uploadLeadDocument(
  leadId: string,
  payload: {
    documentType: string;
    file: File;
    password?: string;
    status?: EntryStatus;
  },
): Promise<ApiLeadDocument> {
  const formData = new FormData();
  formData.append('document_type', mapDocumentTypeToApi(payload.documentType));
  formData.append('file', payload.file);
  if (payload.password) {
    formData.append('password', payload.password);
  }
  if (payload.status) {
    formData.append('status', payload.status);
  }
  return apiPostForm<ApiLeadDocument>(`/leads/${leadId}/documents/`, formData);
}

export async function updateLeadDocument(
  leadId: string,
  documentId: string,
  payload: {
    documentType?: string;
    file?: File;
    password?: string;
    status?: EntryStatus;
  },
): Promise<ApiLeadDocument> {
  const formData = new FormData();
  if (payload.documentType) {
    formData.append('document_type', mapDocumentTypeToApi(payload.documentType));
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }
  if (payload.password !== undefined) {
    formData.append('password', payload.password);
  }
  if (payload.status) {
    formData.append('status', payload.status);
  }
  return apiPatchForm<ApiLeadDocument>(`/leads/${leadId}/documents/${documentId}/`, formData);
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const blob = await fetchAuthenticatedFileBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchAuthenticatedFileBlob(url: string): Promise<Blob> {
  const tokens = getStoredTokens();
  const response = await fetch(url, {
    headers: tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to load file');
  }
  return response.blob();
}

export async function deleteLeadDocument(leadId: string, documentId: string): Promise<void> {
  await apiDelete(`/leads/${leadId}/documents/${documentId}/`);
}

export function getLeadDocumentDownloadUrl(leadId: string, documentId: string): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
  return `${base}/leads/${leadId}/documents/${documentId}/download/`;
}

export async function fetchLeadAddresses(leadId: string): Promise<ApiLeadAddress[]> {
  return fetchOptionalList(() => apiGet<ApiLeadAddress[]>(`/leads/${leadId}/addresses/`));
}

export async function createLeadAddress(
  leadId: string,
  payload: {
    addressType: string;
    pincode: string;
    state: string;
    city: string;
    address: string;
    status: EntryStatus;
  },
): Promise<ApiLeadAddress> {
  return apiPost<ApiLeadAddress>(`/leads/${leadId}/addresses/`, {
    address_type: mapAddressTypeToApi(payload.addressType),
    pincode: payload.pincode,
    state: payload.state,
    city: payload.city,
    address: payload.address,
    status: payload.status,
  });
}

export async function updateLeadAddress(
  leadId: string,
  addressId: string,
  payload: {
    addressType?: string;
    pincode?: string;
    state?: string;
    city?: string;
    address?: string;
    status?: EntryStatus;
  },
): Promise<ApiLeadAddress> {
  return apiPatch<ApiLeadAddress>(`/leads/${leadId}/addresses/${addressId}/`, {
    ...(payload.addressType && { address_type: mapAddressTypeToApi(payload.addressType) }),
    ...(payload.pincode !== undefined && { pincode: payload.pincode }),
    ...(payload.state !== undefined && { state: payload.state }),
    ...(payload.city !== undefined && { city: payload.city }),
    ...(payload.address !== undefined && { address: payload.address }),
    ...(payload.status && { status: payload.status }),
  });
}

export async function deleteLeadAddress(leadId: string, addressId: string): Promise<void> {
  await apiDelete(`/leads/${leadId}/addresses/${addressId}/`);
}

export async function fetchLeadCompanies(leadId: string): Promise<ApiLeadCompany[]> {
  return fetchOptionalList(() => apiGet<ApiLeadCompany[]>(`/leads/${leadId}/companies/`));
}

export async function createLeadCompany(
  leadId: string,
  payload: {
    companyName: string;
    companyAddress: string;
    status: EntryStatus;
  },
): Promise<ApiLeadCompany> {
  return apiPost<ApiLeadCompany>(`/leads/${leadId}/companies/`, {
    company_name: payload.companyName,
    company_address: payload.companyAddress,
    status: payload.status,
  });
}

export async function updateLeadCompany(
  leadId: string,
  companyId: string,
  payload: {
    companyName?: string;
    companyAddress?: string;
    status?: EntryStatus;
  },
): Promise<ApiLeadCompany> {
  return apiPatch<ApiLeadCompany>(`/leads/${leadId}/companies/${companyId}/`, {
    ...(payload.companyName !== undefined && { company_name: payload.companyName }),
    ...(payload.companyAddress !== undefined && { company_address: payload.companyAddress }),
    ...(payload.status && { status: payload.status }),
  });
}

export async function deleteLeadCompany(leadId: string, companyId: string): Promise<void> {
  await apiDelete(`/leads/${leadId}/companies/${companyId}/`);
}

export async function fetchLeadReferences(leadId: string): Promise<ApiLeadReference[]> {
  return fetchOptionalList(() => apiGet<ApiLeadReference[]>(`/leads/${leadId}/references/`));
}

export async function createLeadReference(
  leadId: string,
  payload: {
    relation: string;
    referenceName: string;
    referenceMobile: string;
  },
): Promise<ApiLeadReference> {
  return apiPost<ApiLeadReference>(`/leads/${leadId}/references/`, {
    relation: mapRelationToApi(payload.relation),
    reference_name: payload.referenceName,
    reference_mobile: payload.referenceMobile,
  });
}

export async function updateLeadReference(
  leadId: string,
  referenceId: string,
  payload: {
    relation?: string;
    referenceName?: string;
    referenceMobile?: string;
    status?: EntryStatus;
  },
): Promise<ApiLeadReference> {
  return apiPatch<ApiLeadReference>(`/leads/${leadId}/references/${referenceId}/`, {
    ...(payload.relation && { relation: mapRelationToApi(payload.relation) }),
    ...(payload.referenceName !== undefined && { reference_name: payload.referenceName }),
    ...(payload.referenceMobile !== undefined && { reference_mobile: payload.referenceMobile }),
    ...(payload.status && { status: payload.status }),
  });
}

export async function deleteLeadReference(leadId: string, referenceId: string): Promise<void> {
  await apiDelete(`/leads/${leadId}/references/${referenceId}/`);
}

export async function fetchLeadEsignRequests(leadId: string): Promise<ApiLeadEsignRequest[]> {
  return fetchOptionalList(() =>
    apiGet<ApiLeadEsignRequest[]>(`/leads/${leadId}/esign-requests/`),
  );
}

export async function sendLeadEsignRequest(
  leadId: string,
  signType?: ApiLeadEsignRequest['sign_type'],
): Promise<ApiLeadEsignRequest> {
  return apiPost<ApiLeadEsignRequest>(
    `/leads/${leadId}/esign-requests/`,
    signType ? { sign_type: signType } : {},
  );
}

export async function fetchLeadVideoKycRequests(
  leadId: string,
): Promise<ApiLeadVideoKycRequest[]> {
  return fetchOptionalList(() =>
    apiGet<ApiLeadVideoKycRequest[]>(`/leads/${leadId}/video-kyc-requests/`),
  );
}

export async function fetchLeadEmployments(leadId: string): Promise<ApiLeadEmployment[]> {
  return fetchOptionalList(() =>
    apiGet<ApiLeadEmployment[]>(`/leads/${leadId}/employments/`),
  );
}

export async function sendLeadVideoKycRequest(
  leadId: string,
): Promise<ApiLeadVideoKycRequest> {
  return apiPost<ApiLeadVideoKycRequest>(`/leads/${leadId}/video-kyc-requests/`, {
    verification_method: 'mobile',
  });
}

export function videoKycDispatchMessage(
  created: Pick<ApiLeadVideoKycRequest, 'email_sent' | 'sms_sent'>,
  email?: string,
  mobile?: string,
): { text: string; ok: boolean } {
  const parts: string[] = [];
  if (created.email_sent) parts.push(email ? `email ${email}` : 'email');
  if (created.sms_sent) parts.push(mobile ? `mobile ${mobile}` : 'mobile');
  if (parts.length === 2) {
    return { text: `Video KYC link sent to ${parts[0]} and ${parts[1]}.`, ok: true };
  }
  if (parts.length === 1) {
    return { text: `Video KYC link sent to ${parts[0]}.`, ok: true };
  }
  return {
    text: 'Video KYC was created, but the link could not be emailed or SMS’d. Use Open to share it.',
    ok: false,
  };
}

export async function fetchLeadVideoKycRequestDetail(
  leadId: string,
  requestId: string,
): Promise<ApiLeadVideoKycDetail> {
  return apiGet<ApiLeadVideoKycDetail>(`/leads/${leadId}/video-kyc-requests/${requestId}/`);
}

// --- Loan workflow (sanction, rejection, disbursal, collection, remarks) ---

export interface ApiSanctionSalaryBank {
  bank_id: string;
  bank_name: string;
  account_number: string;
}

export interface ApiLeadSanction {
  id: string;
  application_id?: string;
  product_id?: string;
  product_name?: string;
  loan_amount: string;
  branch: string;
  roi: string;
  repayment_date: string;
  official_email: string;
  alternate_mobile: string;
  admin_fees: string;
  pf_percentage: string;
  gst: string;
  monthly_income: string;
  cibil_score: string;
  pl_active: number;
  hl_active: number;
  active_payday_loan: number;
  monthly_obligation: string;
  residential_type: string;
  employment_type: string;
  loan_purpose: string;
  salary_account: string;
  salary_banks?: ApiSanctionSalaryBank[];
  remarks: string;
  approved_on: string;
  loan_tenure?: string;
  lead_status?: string;
  rejection_reason?: string;
  sanctioned_by?: string;
  amount_to_be_disbursed?: string;
  repay_amount?: string;
  lead_remarks?: string;
  bank?: string;
  approval_status?: string;
  matrix_approved_by?: string;
  approval_remarks?: string;
}

export interface ApiLeadRejection {
  id: string;
  branch: string;
  official_email: string;
  cibil_score: string;
  rejection_reason: string;
  remarks: string;
  rejected_on: string;
}

export interface ApiLeadDisbursal {
  id: string;
  loan_no?: string;
  company_account: string;
  salary_account?: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch: string;
  cheque_no: string;
  enach_id: string;
  fi_date: string | null;
  fi_type: string;
  fi_done_by: string;
  amount_to_be_disbursed: string;
  total_deduction: string;
  disbursal_reference_no: string;
  payment_type: string;
  disbursal_date: string;
  disbursal_sheet_date?: string;
  disbursed_date?: string;
  disbursal_type?: string;
  repay_amount?: string;
  repay_date?: string;
  status?: string;
  disbursed_by?: string;
  lead_transfer_to_legal?: string;
  lead_transfer_date?: string;
  remarks: string;
  disbursed_on: string;
}

export interface ApiLoanSummary {
  branch: string;
  loan_disbursed: string;
  roi: string;
  number_of_days: string;
  real_days: string;
  penalty_days: string;
  real_interest: string;
  penalty_interest: string;
  paid_amount: string;
  till_date_amount: string;
  repay_amount: string;
}

export interface ApiCompanyAccountProfile {
  id: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
}

export interface ApiDisbursalDefaults {
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch: string;
}

export interface ApiDisbursalResponse {
  disbursal: ApiLeadDisbursal | null;
  loan_summary: ApiLoanSummary;
  company_account_profile?: ApiCompanyAccountProfile | null;
  disbursal_defaults?: ApiDisbursalDefaults | null;
  net_disbursal?: {
    principal_amount: string;
    processing_fee: string;
    gst: string;
    total_deduction: string;
    amount_to_be_disbursed: string;
  };
  fi_investigators?: Array<{ id: string; name: string; email: string }>;
  stage?: 'none' | 'sheet_sent' | 'disbursed';
  application_status?: string | null;
  application_status_display?: string | null;
}

export interface ApiLeadCollection {
  id: string;
  till_date_amount: string;
  collected_amount: string;
  penalty_amount: string;
  collection_mode: string;
  utr_number: string;
  collection_date_time: string;
  wave_off: string;
  settlement_amount: string;
  status: string;
  status_display: string;
  collection_source: string;
  remarks: string;
  recorded_on: string;
}

export interface ApiCollectionCreateResponse {
  collection: ApiLeadCollection;
  lead_status: string;
  lead_status_display: string;
}

export interface ApiLeadFollowUpRemark {
  id: string;
  remark_category: string;
  follow_up_date: string | null;
  priority: string;
  notes: string;
  recorded_on: string;
}

const COLLECTION_STATUS_TO_API: Record<string, string> = {
  'Part Payment': 'part_payment',
  Close: 'close',
  'Payday Pre-Close': 'payday_pre_close',
  Settlement: 'settlement',
};

const COLLECTION_STATUS_FROM_API: Record<string, string> = {
  part_payment: 'Part Payment',
  close: 'Closed',
  payday_pre_close: 'Payday Pre-Close',
  settlement: 'Settlement',
};

const PAYMENT_MODE_TO_API: Record<string, string> = {
  Cash: 'cash',
  UPI: 'upi',
  NEFT: 'neft',
  RTGS: 'rtgs',
  IMPS: 'imps',
  Cheque: 'cheque',
};

const PAYMENT_MODE_FROM_API: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_MODE_TO_API).map(([label, code]) => [code, label]),
);

function mapPaymentModeToApi(label: string): string {
  return PAYMENT_MODE_TO_API[label] ?? label.toLowerCase();
}

function mapPaymentModeFromApi(code: string): string {
  return PAYMENT_MODE_FROM_API[code] ?? code.toUpperCase();
}

function asSanctionDetailString(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  if (value == null || value === '') return '';
  return String(value);
}

function asSanctionDetailNumber(details: Record<string, unknown>, key: string): number {
  const value = Number(details[key]);
  return Number.isFinite(value) ? value : 0;
}

function asSanctionGst(details: Record<string, unknown>, fallback = '0'): string {
  return asSanctionDetailString(details, 'gst') || asSanctionDetailString(details, 'admin_gst') || fallback;
}

function mapSanctionSalaryBanksFromDetails(
  details: Record<string, unknown>,
): ApiSanctionSalaryBank[] {
  const raw = details.salary_banks;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry != null)
    .map((entry) => ({
      bank_id: asSanctionDetailString(entry, 'bank_id'),
      bank_name: asSanctionDetailString(entry, 'bank_name'),
      account_number: asSanctionDetailString(entry, 'account_number'),
    }))
    .filter((entry) => entry.bank_id || entry.bank_name);
}

function normalizeSanctionRepaymentDate(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const iso = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  return parseIsoDate(iso) ? iso : '';
}

function computeApprovedTenureDays(
  repaymentDate: string,
  product?: ApiLoanProduct | null,
  disbursalDate = new Date(),
): number | undefined {
  const limits = resolveRepaymentTenureLimits(product);
  if (validateSanctionRepaymentDate(repaymentDate, limits, disbursalDate)) {
    return undefined;
  }
  return computeSanctionRepaymentTenureDays(repaymentDate, limits, disbursalDate);
}

function formatProductRate(value: string | number | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(2);
}

export function resolveProductPfPercentage(product: ApiLoanProduct): string {
  if (product.processing_fee_type === 'percentage') {
    return formatProductRate(product.processing_fee_percentage);
  }
  return '';
}

const ADDRESS_TYPE_PRIORITY = ['own', 'rented'] as const;

function resolvePrimaryResidentialType(addresses: ApiLeadAddress[]): string {
  if (!addresses.length) return '';
  const byType = new Map(
    addresses.map((address) => [address.address_type.trim().toLowerCase(), address]),
  );
  for (const addressType of ADDRESS_TYPE_PRIORITY) {
    const match = byType.get(addressType);
    if (match) return mapAddressTypeFromApi(match.address_type);
  }
  return mapAddressTypeFromApi(addresses[0].address_type);
}

function resolveSanctionResidentialTypeLabel(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return mapAddressTypeFromApi(trimmed);
}

export async function fetchLeadSanctionFormContext(leadId: string): Promise<{
  products: ApiLoanProduct[];
  initialProductId: string;
  lockProductSelection: boolean;
  selectedProduct: ApiLoanProduct | null;
  defaultLoanPurpose: string;
  defaultResidentialType: string;
}> {
  const [products, application, leadResult, addresses] = await Promise.all([
    fetchProducts(),
    getLeadApplication(leadId),
    fetchLead(leadId).catch(() => null),
    fetchLeadAddresses(leadId),
  ]);

  let initialProductId = application?.product ?? '';
  const lockProductSelection = Boolean(application);

  if (!initialProductId && leadResult?.interested_product) {
    initialProductId = leadResult.interested_product;
  }

  if (!initialProductId) {
    initialProductId =
      products.find((item) => item.product_code === 'PAYDAY')?.id ?? products[0]?.id ?? '';
  }

  const selectedProduct = products.find((item) => item.id === initialProductId) ?? null;
  const defaultLoanPurpose = leadResult
    ? String(normalizeLoanPurpose(leadResult.loan_purpose || leadResult.product_name || ''))
    : '';
  const defaultResidentialType = resolvePrimaryResidentialType(addresses);

  return {
    products,
    initialProductId,
    lockProductSelection,
    selectedProduct,
    defaultLoanPurpose,
    defaultResidentialType,
  };
}

export async function fetchLeadSanctionProduct(leadId: string): Promise<ApiLoanProduct | null> {
  const context = await fetchLeadSanctionFormContext(leadId);
  return context.selectedProduct;
}

function buildSanctionDetailsPayload(payload: {
  branch: string;
  repaymentDate: string;
  officialEmail: string;
  alternateMobile: string;
  pfPercentage: string;
  gstRatePercent?: string;
  monthlyIncome: string;
  cibilScore: string;
  plActive: string;
  hlActive: string;
  activePaydayLoan: string;
  monthlyObligation: string;
  residentialType: string;
  employmentType: string;
  loanPurpose: string;
  salaryAccount?: string;
  bankName?: string;
  salaryBanks?: ApiSanctionSalaryBank[];
}): Record<string, unknown> {
  const salaryBanks = (payload.salaryBanks ?? [])
    .filter((row) => row.bank_id?.trim())
    .map((row) => ({
      bank_id: row.bank_id,
      bank_name: row.bank_name,
      account_number: row.account_number ?? '',
    }));
  const primaryAccount =
    salaryBanks.find((row) => row.account_number?.trim())?.account_number?.trim() ??
    payload.salaryAccount?.trim() ??
    '';

  return {
    branch: payload.branch,
    repayment_date: payload.repaymentDate,
    official_email: payload.officialEmail,
    alternate_mobile: payload.alternateMobile,
    pf_percentage: payload.pfPercentage,
    ...(payload.gstRatePercent ? { gst_rate_percent: payload.gstRatePercent } : {}),
    monthly_income: payload.monthlyIncome,
    cibil_score: payload.cibilScore,
    pl_active: Number(payload.plActive) || 0,
    hl_active: Number(payload.hlActive) || 0,
    active_payday_loan: Number(payload.activePaydayLoan) || 0,
    monthly_obligation: payload.monthlyObligation,
    residential_type: payload.residentialType,
    employment_type: payload.employmentType,
    loan_purpose: payload.loanPurpose,
    ...(salaryBanks.length ? { salary_banks: salaryBanks } : {}),
    ...(primaryAccount ? { salary_account: primaryAccount } : {}),
    ...(salaryBanks.length
      ? { bank_name: salaryBanks.map((row) => row.bank_name).filter(Boolean).join(', ') }
      : payload.bankName
        ? { bank_name: payload.bankName }
        : {}),
  };
}

export interface ApiSanctionFeeCalculation {
  processing_fee: string;
  gst: string;
  pf_percentage: string;
  gst_rate_percent: string;
}

export async function calculateSanctionFees(
  principalAmount: string,
  pfPercentage: string,
  gstPercentage?: string,
): Promise<ApiSanctionFeeCalculation> {
  return apiPost<ApiSanctionFeeCalculation>('/applications/sanction-fees/calculate/', {
    principal_amount: principalAmount || '0',
    pf_percentage: pfPercentage || '0',
    ...(gstPercentage ? { gst_percentage: gstPercentage } : {}),
  });
}

function mapApplicationDecisionToSanction(
  application: Awaited<ReturnType<typeof getLeadApplication>>,
  payload?: {
    branch?: string;
    officialEmail?: string;
    alternateMobile?: string;
    remarks?: string;
    pfPercentage?: string;
    gst?: string;
    repaymentDate?: string;
    monthlyIncome?: string;
    cibilScore?: string;
    plActive?: string;
    hlActive?: string;
    activePaydayLoan?: string;
    monthlyObligation?: string;
    residentialType?: string;
    employmentType?: string;
    loanPurpose?: string;
    salaryAccount?: string;
  },
): ApiLeadSanction | null {
  if (!application?.latest_decision || application.latest_decision.decision !== 'approved') {
    return null;
  }
  const decision = application.latest_decision;
  const details = (decision.sanction_details ?? {}) as Record<string, unknown>;
  return {
    id: decision.id,
    product_id: application.product ?? '',
    product_name: application.product_name ?? '',
    loan_amount: String(decision.approved_amount ?? application.approved_amount ?? ''),
    branch: asSanctionDetailString(details, 'branch') || payload?.branch || '',
    roi: formatRate(decision.interest_rate ?? ''),
    repayment_date:
      normalizeSanctionRepaymentDate(asSanctionDetailString(details, 'repayment_date')) ||
      normalizeSanctionRepaymentDate(payload?.repaymentDate) ||
      '',
    official_email: asSanctionDetailString(details, 'official_email') || payload?.officialEmail || '',
    alternate_mobile: asSanctionDetailString(details, 'alternate_mobile') || payload?.alternateMobile || '',
    admin_fees: String(decision.processing_fee ?? '0'),
    pf_percentage: formatRate(
      asSanctionDetailString(details, 'pf_percentage') || payload?.pfPercentage || '0',
    ),
    gst: asSanctionGst(details, payload?.gst || '0'),
    monthly_income: asSanctionDetailString(details, 'monthly_income') || payload?.monthlyIncome || '0',
    cibil_score: asSanctionDetailString(details, 'cibil_score') || payload?.cibilScore || '',
    pl_active: asSanctionDetailNumber(details, 'pl_active') || Number(payload?.plActive ?? 0),
    hl_active: asSanctionDetailNumber(details, 'hl_active') || Number(payload?.hlActive ?? 0),
    active_payday_loan:
      asSanctionDetailNumber(details, 'active_payday_loan') || Number(payload?.activePaydayLoan ?? 0),
    monthly_obligation:
      asSanctionDetailString(details, 'monthly_obligation') || payload?.monthlyObligation || '0',
    residential_type: asSanctionDetailString(details, 'residential_type') || payload?.residentialType || '',
    employment_type: asSanctionDetailString(details, 'employment_type') || payload?.employmentType || '',
    loan_purpose:
      asSanctionDetailString(details, 'loan_purpose') ||
      payload?.loanPurpose ||
      application.purpose ||
      '',
    salary_account: asSanctionDetailString(details, 'salary_account') || payload?.salaryAccount || '',
    salary_banks: mapSanctionSalaryBanksFromDetails(details),
    remarks: decision.remarks ?? payload?.remarks ?? '',
    approved_on: decision.decided_at || application.decided_at || '',
    sanctioned_by: decision.decided_by_name || decision.decided_by_email || '',
    approval_remarks: decision.remarks ?? payload?.remarks ?? '',
  };
}

function computeSanctionNetDisbursal(base: ApiLeadSanction): string {
  const principal = Number(base.loan_amount);
  const processingFee = Number(base.admin_fees);
  const gst = Number(base.gst);
  if (!Number.isFinite(principal)) return '';
  const net = Math.max(
    0,
    principal -
      (Number.isFinite(processingFee) ? processingFee : 0) -
      (Number.isFinite(gst) ? gst : 0),
  );
  return net.toFixed(2);
}

async function enrichLeadSanctionFromSubmit(
  base: ApiLeadSanction,
  application: NonNullable<Awaited<ReturnType<typeof getLeadApplication>>>,
  options?: {
    loan?: { total_repayable?: string } | null;
    approvedTenureDays?: number;
  },
): Promise<ApiLeadSanction> {
  const decision = application.latest_decision;
  const details = (decision?.sanction_details ?? {}) as Record<string, unknown>;
  const tenureDays = options?.approvedTenureDays ?? '';

  return {
    ...base,
    application_id: application.id,
    loan_tenure: tenureDays ? String(tenureDays) : '',
    lead_status: application.status_display ?? '',
    rejection_reason: '',
    sanctioned_by: base.sanctioned_by || decision?.decided_by_name || decision?.decided_by_email || '',
    amount_to_be_disbursed: computeSanctionNetDisbursal(base),
    repay_amount: options?.loan?.total_repayable ?? base.loan_amount,
    lead_remarks: '',
    bank: asSanctionDetailString(details, 'bank_name') || '',
    approval_status: application.status_display ?? '',
    matrix_approved_by: '',
    approval_remarks: base.approval_remarks ?? base.remarks ?? '',
  };
}

async function enrichLeadSanction(
  base: ApiLeadSanction,
  leadId: string,
  application: Awaited<ReturnType<typeof getLeadApplication>>,
): Promise<ApiLeadSanction> {
  const [lead, loan, disbursalPreview] = await Promise.all([
    fetchLead(leadId).catch(() => null),
    application ? getLoanForApplication(application.id).catch(() => null) : Promise.resolve(null),
    apiGet<ApiDisbursalResponse>(`/leads/${leadId}/disbursal/`).catch(() => null),
  ]);
  const decision = application?.latest_decision;
  const details = (decision?.sanction_details ?? {}) as Record<string, unknown>;
  const tenureDays = disbursalPreview?.loan_summary?.number_of_days ?? '';

  return {
    ...base,
    application_id: application.id,
    loan_tenure: tenureDays ? String(tenureDays) : '',
    lead_status: lead?.status_display || '',
    rejection_reason: '',
    sanctioned_by: base.sanctioned_by || decision?.decided_by_name || decision?.decided_by_email || '',
    amount_to_be_disbursed:
      disbursalPreview?.net_disbursal?.amount_to_be_disbursed ?? computeSanctionNetDisbursal(base),
    repay_amount: disbursalPreview?.loan_summary?.repay_amount ?? loan?.total_repayable ?? base.loan_amount,
    lead_remarks: '',
    bank:
      disbursalPreview?.disbursal_defaults?.bank_name ||
      asSanctionDetailString(details, 'bank_name') ||
      '',
    approval_status: application?.status_display ?? '',
    matrix_approved_by: '',
    approval_remarks: base.approval_remarks ?? base.remarks ?? '',
  };
}

function mapApplicationDecisionToRejection(
  application: Awaited<ReturnType<typeof getLeadApplication>>,
  payload?: {
    branch?: string;
    officialEmail?: string;
    cibilScore?: string;
  },
): ApiLeadRejection | null {
  if (!application?.latest_decision || application.latest_decision.decision !== 'rejected') {
    return null;
  }
  const decision = application.latest_decision;
  const details = decision.sanction_details ?? {};
  return {
    id: decision.id,
    branch: asSanctionDetailString(details, 'branch') || payload?.branch || '',
    official_email:
      asSanctionDetailString(details, 'official_email') || payload?.officialEmail || '',
    cibil_score: asSanctionDetailString(details, 'cibil_score') || payload?.cibilScore || '',
    rejection_reason: decision.rejection_reason,
    remarks: decision.remarks,
    rejected_on: decision.decided_at,
  };
}

export async function fetchLeadSanction(leadId: string): Promise<ApiLeadSanction | null> {
  const application = await getLeadApplication(leadId);
  const base = mapApplicationDecisionToSanction(application);
  if (!base) return null;
  return enrichLeadSanction(base, leadId, application);
}

export async function createLeadSanction(
  leadId: string,
  payload: {
    loanAmount: string;
    productId: string;
    branch: string;
    roi: string;
    repaymentDate: string;
    officialEmail: string;
    alternateMobile: string;
    pfPercentage: string;
    gstRatePercent?: string;
    monthlyIncome: string;
    cibilScore: string;
    plActive: string;
    hlActive: string;
    activePaydayLoan: string;
    monthlyObligation: string;
    residentialType: string;
    employmentType: string;
    loanPurpose: string;
    remarks: string;
    salaryBanks?: ApiSanctionSalaryBank[];
  },
  options?: { product?: ApiLoanProduct | null; applicationId?: string | null },
): Promise<ApiLeadSanction> {
  let application: NonNullable<Awaited<ReturnType<typeof getLeadApplication>>>;
  if (options?.applicationId) {
    application = await fetchApplication(options.applicationId);
  } else {
    ({ application } = await ensureLeadApplication(leadId, {
      requestedAmount: payload.loanAmount,
      productId: payload.productId,
    }));
  }
  const submitted = await submitApplicationIfNeeded(application);
  const sanctionDetails = buildSanctionDetailsPayload(payload);
  const product =
    options?.product ??
    (await fetchProducts()).find((item) => item.id === payload.productId) ??
    null;
  const tenureLimits = resolveRepaymentTenureLimits(product);
  const bankHolidayLabels = await fetchBankHolidayLabelMap();
  const repaymentValidationError = validateSanctionRepaymentDate(
    payload.repaymentDate,
    tenureLimits,
    new Date(),
    bankHolidayLabels,
  );
  if (repaymentValidationError) {
    throw new Error(repaymentValidationError);
  }
  const approvedTenure = computeApprovedTenureDays(payload.repaymentDate, product);
  const decided = await decideApplication(submitted.id, {
    decision: 'approved',
    approved_amount: payload.loanAmount,
    ...(approvedTenure ? { approved_tenure_value: approvedTenure } : {}),
    interest_rate: payload.roi,
    remarks: payload.remarks,
    sanction_details: sanctionDetails,
  });
  const mapped = mapApplicationDecisionToSanction(decided, payload);
  if (!mapped) {
    throw new Error('Sanction decision was not recorded.');
  }
  return enrichLeadSanctionFromSubmit(mapped, decided, {
    approvedTenureDays: approvedTenure,
  });
}

export async function fetchLeadRejection(leadId: string): Promise<ApiLeadRejection | null> {
  const application = await getLeadApplication(leadId);
  return mapApplicationDecisionToRejection(application);
}

export async function createLeadRejection(
  leadId: string,
  payload: {
    branch: string;
    officialEmail: string;
    cibilScore: string;
    rejectionReason: string;
    remarks: string;
  },
): Promise<ApiLeadRejection> {
  const { application } = await ensureLeadApplication(leadId);
  const decided = await decideApplication(application.id, {
    decision: 'rejected',
    rejection_reason: payload.rejectionReason,
    remarks: payload.remarks,
    sanction_details: {
      branch: payload.branch,
      official_email: payload.officialEmail,
      cibil_score: payload.cibilScore,
    },
  });
  const mapped = mapApplicationDecisionToRejection(decided, payload);
  if (!mapped) {
    throw new Error('Rejection decision was not recorded.');
  }
  return mapped;
}

function payloadBranch(application: Awaited<ReturnType<typeof getLeadApplication>>): string {
  const sheetBranch = application?.disbursal_sheet_details?.branch;
  if (typeof sheetBranch === 'string' && sheetBranch) {
    return sheetBranch;
  }
  return application?.branch ?? '';
}

function mapDisbursalSheetToApi(
  application: NonNullable<Awaited<ReturnType<typeof getLeadApplication>>>,
  loanId?: string,
): ApiLeadDisbursal {
  const details = (application.disbursal_sheet_details ?? {}) as Record<string, unknown>;
  const sentAt = application.disbursal_sheet_sent_at ?? application.updated_at ?? '';
  return {
    id: loanId ?? application.id,
    company_account: String(details.company_account ?? details.salary_account ?? ''),
    salary_account: String(details.company_account ?? details.salary_account ?? ''),
    account_number: String(details.account_number ?? ''),
    ifsc_code: String(details.ifsc_code ?? ''),
    bank_name: String(details.bank_name ?? ''),
    branch: String(details.branch ?? payloadBranch(application)),
    cheque_no: String(details.cheque_no ?? ''),
    enach_id: String(details.enach_id ?? ''),
    fi_date: details.fi_date ? String(details.fi_date) : null,
    fi_type: String(details.fi_type ?? ''),
    fi_done_by: String(details.fi_done_by ?? ''),
    amount_to_be_disbursed: String(details.amount_to_be_disbursed ?? ''),
    total_deduction: String(details.total_deduction ?? '0'),
    disbursal_reference_no: String(details.disbursal_reference_no ?? ''),
    payment_type: String(details.payment_type ?? 'IMPS'),
    disbursal_date: String(details.disbursal_date ?? ''),
    disbursed_date: String(details.disbursed_date ?? ''),
    disbursal_type: String(details.disbursal_type ?? ''),
    remarks: String(details.remarks ?? ''),
    disbursed_on: sentAt,
  };
}

function buildDisbursalSheetPayload(payload: {
  companyAccount: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  chequeNo: string;
  enachId: string;
  fiDate: string;
  fiType: string;
  fiDoneBy: string;
  totalDeduction: string;
  paymentType: string;
  remarks: string;
}) {
  return {
    company_account: payload.companyAccount,
    account_number: payload.accountNumber,
    ifsc_code: payload.ifscCode,
    bank_name: payload.bankName,
    branch: payload.branch,
    cheque_no: payload.chequeNo,
    enach_id: payload.enachId,
    fi_date: payload.fiDate || null,
    fi_type: payload.fiType,
    fi_done_by: payload.fiDoneBy,
    total_deduction: payload.totalDeduction || '0',
    payment_type: payload.paymentType || 'IMPS',
    remarks: payload.remarks,
  };
}

export async function fetchLeadDisbursal(leadId: string): Promise<ApiDisbursalResponse> {
  return apiGet<ApiDisbursalResponse>(`/leads/${leadId}/disbursal/`);
}

export async function createLeadDisbursal(
  leadId: string,
  payload: {
    companyAccount: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branch: string;
    chequeNo: string;
    enachId: string;
    fiDate: string;
    fiType: string;
    fiDoneBy: string;
    totalDeduction: string;
    disbursalReferenceNo: string;
    paymentType: string;
    disbursalType?: string;
    remarks: string;
  },
): Promise<ApiDisbursalResponse> {
  const { application } = await ensureLeadApplication(leadId);
  await ensureLoan(application.id);
  const sheetPayload = buildDisbursalSheetPayload(payload);
  const referenceNo = payload.disbursalReferenceNo.trim();

  if (!referenceNo) {
    await submitDisbursalSheet(application.id, sheetPayload);
    return fetchLeadDisbursal(leadId);
  }

  const loan = await getLoanForApplication(application.id);
  if (!loan) {
    throw new Error('Loan record was not found for this lead.');
  }

  if (loan.disbursed_at) {
    const preview = await fetchLeadDisbursal(leadId);
    const disbursedAmount =
      preview.net_disbursal?.amount_to_be_disbursed ??
      preview.disbursal?.amount_to_be_disbursed ??
      '0';
    await updateLoanDisbursement(loan.id, {
      utr_reference: referenceNo,
      disbursed_amount: disbursedAmount,
      payment_mode: payload.paymentType || 'NEFT',
      remarks: payload.remarks,
    });
  } else {
    if (application.status === 'approved') {
      await submitDisbursalSheet(application.id, sheetPayload);
    }
    const preview = await fetchLeadDisbursal(leadId);
    const disbursedAmount =
      preview.net_disbursal?.amount_to_be_disbursed ??
      preview.disbursal?.amount_to_be_disbursed ??
      '0';
    await disburseLoan(loan.id, {
      utr_reference: referenceNo,
      disbursed_amount: disbursedAmount,
      payment_mode: payload.paymentType || 'NEFT',
      disbursal_type: payload.disbursalType?.toLowerCase(),
      remarks: payload.remarks,
    });
  }
  return fetchLeadDisbursal(leadId);
}

export async function fetchLeadCollections(leadId: string): Promise<ApiLeadCollection[]> {
  return apiGet<ApiLeadCollection[]>(`/leads/${leadId}/collections/`);
}

type LeadCollectionPayload = {
  tillDateAmount: string;
  collectedAmount: string;
  penaltyAmount: string;
  collectionMode: string;
  utrNumber: string;
  collectionDateTime: string;
  waveOff: string;
  settlementAmount: string;
  status: string;
  collectionSource: string;
  remarks: string;
};

async function resolveDisbursedLoanId(leadId: string): Promise<string> {
  const disbursalResponse = await fetchLeadDisbursal(leadId);
  const loanId = disbursalResponse.disbursal?.id;
  if (!loanId || disbursalResponse.stage !== 'disbursed') {
    throw new Error('Loan must be disbursed before recording collection.');
  }
  return loanId;
}

function buildLeadCollectionFromResult(
  result: Awaited<ReturnType<typeof recordLoanRepayment>>,
  payload: LeadCollectionPayload,
): ApiLeadCollection {
  return {
    id: result.repayment.id,
    till_date_amount: result.till_date_amount ?? result.amount_due ?? payload.tillDateAmount,
    collected_amount: result.repayment.amount,
    penalty_amount: payload.penaltyAmount || '0',
    collection_mode: mapPaymentModeFromApi(result.repayment.payment_mode),
    utr_number: result.repayment.utr,
    collection_date_time: result.repayment.payment_date,
    wave_off: payload.waveOff || '0',
    settlement_amount: payload.settlementAmount || '0',
    status: result.collection_status ?? 'part_payment',
    status_display: result.collection_status_display ?? 'Part Payment',
    collection_source: payload.collectionSource,
    remarks: result.repayment.remarks,
    recorded_on: result.repayment.created_at,
  };
}

export async function createLeadCollection(
  leadId: string,
  payload: LeadCollectionPayload,
): Promise<ApiCollectionCreateResponse> {
  const loanId = await resolveDisbursedLoanId(leadId);
  const result = await recordLoanRepayment(loanId, {
    amount: payload.collectedAmount,
    payment_mode: mapPaymentModeToApi(payload.collectionMode),
    utr: payload.utrNumber,
    payment_date: payload.collectionDateTime || undefined,
    gateway_reference: payload.collectionSource,
    remarks: payload.remarks,
    collection_status: mapCollectionStatusToApi(payload.status),
  });
  return {
    collection: buildLeadCollectionFromResult(result, payload),
    lead_status: result.lead_status ?? '',
    lead_status_display: result.lead_status_display ?? '',
  };
}

export async function updateLeadCollection(
  leadId: string,
  collectionId: string,
  payload: LeadCollectionPayload,
): Promise<ApiCollectionCreateResponse> {
  const loanId = await resolveDisbursedLoanId(leadId);
  const result = await updateLoanRepayment(loanId, collectionId, {
    amount: payload.collectedAmount,
    payment_mode: mapPaymentModeToApi(payload.collectionMode),
    utr: payload.utrNumber,
    payment_date: payload.collectionDateTime || undefined,
    gateway_reference: payload.collectionSource,
    remarks: payload.remarks,
    collection_status: mapCollectionStatusToApi(payload.status),
  });
  return {
    collection: buildLeadCollectionFromResult(result, payload),
    lead_status: result.lead_status ?? '',
    lead_status_display: result.lead_status_display ?? '',
  };
}

export async function deleteLeadCollection(
  leadId: string,
  collectionId: string,
): Promise<{
  lead_status: string;
  lead_status_display: string;
}> {
  const loanId = await resolveDisbursedLoanId(leadId);
  const result = await deleteLoanRepayment(loanId, collectionId);
  return {
    lead_status: result.lead_status ?? '',
    lead_status_display: result.lead_status_display ?? '',
  };
}

export function mapCollectionStatusFromApi(code: string): string {
  return COLLECTION_STATUS_FROM_API[code] ?? code;
}

export async function fetchLeadFollowUpRemarks(leadId: string): Promise<ApiLeadFollowUpRemark[]> {
  return apiGet<ApiLeadFollowUpRemark[]>(`/leads/${leadId}/follow-up-remarks/`);
}

export async function createLeadFollowUpRemark(
  leadId: string,
  payload: {
    remarkCategory: string;
    followUpDate: string;
    priority: string;
    notes: string;
  },
): Promise<ApiLeadFollowUpRemark> {
  return apiPost<ApiLeadFollowUpRemark>(`/leads/${leadId}/follow-up-remarks/`, {
    remark_category: payload.remarkCategory,
    follow_up_date: payload.followUpDate || null,
    priority: payload.priority,
    notes: payload.notes,
  });
}

export async function updateLeadFollowUpRemark(
  leadId: string,
  remarkId: string,
  payload: {
    remarkCategory: string;
    followUpDate: string;
    priority: string;
    notes: string;
  },
): Promise<ApiLeadFollowUpRemark> {
  return apiPatch<ApiLeadFollowUpRemark>(`/leads/${leadId}/follow-up-remarks/${remarkId}/`, {
    remark_category: payload.remarkCategory,
    follow_up_date: payload.followUpDate || null,
    priority: payload.priority,
    notes: payload.notes,
  });
}

export async function deleteLeadFollowUpRemark(
  leadId: string,
  remarkId: string,
): Promise<void> {
  await apiDelete(`/leads/${leadId}/follow-up-remarks/${remarkId}/`);
}

export function mapSanctionFromApi(entry: ApiLeadSanction) {
  return {
    productId: entry.product_id ?? '',
    productName: entry.product_name ?? '',
    loanAmount: entry.loan_amount,
    branch: entry.branch,
    roi: formatRate(entry.roi),
    repaymentDate: normalizeSanctionRepaymentDate(entry.repayment_date),
    officialEmail: entry.official_email,
    alternateMobile: entry.alternate_mobile,
    adminFees: entry.admin_fees,
    pfPercentage: formatRate(entry.pf_percentage),
    gst: entry.gst,
    monthlyIncome: entry.monthly_income,
    cibilScore: entry.cibil_score,
    plActive: String(entry.pl_active),
    hlActive: String(entry.hl_active),
    activePaydayLoan: String(entry.active_payday_loan),
    monthlyObligation: entry.monthly_obligation,
    residentialType: resolveSanctionResidentialTypeLabel(entry.residential_type),
    employmentType: entry.employment_type,
    loanPurpose: String(normalizeLoanPurpose(entry.loan_purpose)),
    salaryAccount: entry.salary_account,
    salaryBanks: entry.salary_banks ?? [],
    remarks: entry.remarks,
    approvedOn: entry.approved_on,
    loanTenure: entry.loan_tenure ?? '',
    leadStatus: entry.lead_status ?? '',
    rejectionReason: entry.rejection_reason ?? '',
    sanctionedBy: entry.sanctioned_by ?? '',
    amountToBeDisbursed: entry.amount_to_be_disbursed ?? '',
    repayAmount: entry.repay_amount ?? '',
    leadRemarks: entry.lead_remarks ?? '',
    bank: entry.bank ?? '',
    approvalStatus: entry.approval_status ?? '',
    matrixApprovedBy: entry.matrix_approved_by ?? '',
    approvalRemarks: entry.approval_remarks ?? entry.remarks ?? '',
  };
}

export function mapRejectionFromApi(entry: ApiLeadRejection) {
  return {
    branch: entry.branch,
    officialEmail: entry.official_email,
    cibilScore: entry.cibil_score,
    rejectionReason: entry.rejection_reason,
    remarks: entry.remarks,
    rejectedOn: entry.rejected_on,
  };
}

export function mapDisbursalFromApi(entry: ApiLeadDisbursal) {
  return {
    loanNo: entry.loan_no ?? '',
    companyAccount: entry.company_account ?? entry.salary_account ?? '',
    accountNumber: entry.account_number,
    ifscCode: entry.ifsc_code,
    bankName: entry.bank_name,
    branch: entry.branch,
    chequeNo: entry.cheque_no,
    enachId: entry.enach_id,
    fiDate: entry.fi_date ?? '',
    fiType: entry.fi_type,
    fiDoneBy: entry.fi_done_by,
    amountToBeDisbursed: entry.amount_to_be_disbursed,
    totalDeduction: entry.total_deduction,
    disbursalReferenceNo: entry.disbursal_reference_no,
    paymentType: entry.payment_type,
    disbursalDate: entry.disbursal_date,
    disbursalSheetDate: entry.disbursal_sheet_date ?? '',
    disbursalType: entry.disbursal_type
      ? entry.disbursal_type.charAt(0).toUpperCase() + entry.disbursal_type.slice(1)
      : '',
    repayAmount: entry.repay_amount ?? '',
    repayDate: entry.repay_date ?? '',
    status: entry.status ?? '',
    disbursedBy: entry.disbursed_by ?? '',
    leadTransferToLegal: entry.lead_transfer_to_legal ?? '',
    leadTransferDate: entry.lead_transfer_date ?? '',
    remarks: entry.remarks,
    disbursedOn: entry.disbursed_on,
  };
}

export function mapLoanSummaryFromApi(summary: ApiLoanSummary) {
  return {
    branch: summary.branch,
    loanDisbursed: summary.loan_disbursed,
    roi: formatRate(summary.roi),
    numberOfDays: summary.number_of_days,
    realDays: summary.real_days,
    penaltyDays: summary.penalty_days,
    realInterest: summary.real_interest,
    penaltyInterest: summary.penalty_interest,
    paidAmount: summary.paid_amount,
    tillDateAmount: summary.till_date_amount,
    repayAmount: summary.repay_amount,
  };
}

export function mapCollectionFromApi(entry: ApiLeadCollection) {
  return {
    id: entry.id,
    tillDateAmount: entry.till_date_amount,
    collectedAmount: entry.collected_amount,
    penaltyAmount: entry.penalty_amount,
    collectionMode: normalizeCollectionModeForForm(entry.collection_mode),
    utrNumber: entry.utr_number,
    collectionDateTime: entry.collection_date_time,
    waveOff: entry.wave_off,
    settlementAmount: entry.settlement_amount,
    status: normalizeCollectionStatusForForm(
      entry.status_display || mapCollectionStatusFromApi(entry.status),
    ),
    collectionSource: normalizeCollectionSourceForForm(entry.collection_source),
    remarks: entry.remarks,
    recordedOn: entry.recorded_on,
  };
}

export function mapFollowUpRemarkFromApi(entry: ApiLeadFollowUpRemark) {
  return {
    id: entry.id,
    remarkCategory: normalizeRemarkCategoryForForm(entry.remark_category),
    followUpDate: normalizeRemarkFollowUpDateForForm(entry.follow_up_date),
    priority: normalizeRemarkPriorityForForm(entry.priority),
    notes: entry.notes,
    recordedOn: entry.recorded_on,
  };
}
