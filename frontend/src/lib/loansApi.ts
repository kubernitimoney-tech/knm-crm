import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export interface ApiLoan {
  id: string;
  loan_account_number: string;
  application: string;
  customer: string;
  customer_name: string;
  product: string;
  product_code: string;
  branch: string | null;
  principal_amount: string;
  processing_fee: string;
  interest_amount: string;
  total_repayable: string;
  outstanding_balance: string;
  interest_rate: string;
  due_date: string | null;
  status: string;
  status_display: string;
  disbursed_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface ApiLoanDisbursement {
  id: string;
  loan: string;
  disbursed_amount: string;
  gross_amount: string;
  deductions: string;
  payment_mode: string;
  utr_reference: string;
  disbursed_at: string;
  status: string;
  remarks: string;
}

export interface ApiLoanRepayment {
  id: string;
  loan: string;
  amount: string;
  payment_mode: string;
  utr: string;
  payment_date: string;
  gateway_reference: string;
  status: string;
  remarks: string;
  created_at: string;
}

export interface PaginatedLoans {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiLoan[];
}

export async function fetchLoans(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  application?: string;
  customer?: string;
}): Promise<PaginatedLoans> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.status) query.set('status', params.status);
  if (params?.application) query.set('application', params.application);
  if (params?.customer) query.set('customer', params.customer);
  const qs = query.toString();
  return apiGet<PaginatedLoans>(`/loans/${qs ? `?${qs}` : ''}`);
}

export async function fetchLoan(loanId: string): Promise<ApiLoan> {
  return apiGet<ApiLoan>(`/loans/${loanId}/`);
}

export async function disburseLoan(
  loanId: string,
  payload: {
    utr_reference: string;
    disbursed_amount?: string | number;
    payment_mode?: string;
    disbursed_at?: string;
    disbursal_type?: string;
    remarks?: string;
  },
): Promise<ApiLoanDisbursement> {
  return apiPost<ApiLoanDisbursement>(`/loans/${loanId}/disburse/`, payload);
}

export async function updateLoanDisbursement(
  loanId: string,
  payload: {
    utr_reference?: string;
    disbursed_amount?: string | number;
    payment_mode?: string;
    remarks?: string;
  },
): Promise<ApiLoanDisbursement> {
  return apiPost<ApiLoanDisbursement>(`/loans/${loanId}/update-disbursement/`, payload);
}

export async function fetchLoanRepayments(loanId: string): Promise<ApiLoanRepayment[]> {
  return apiGet<ApiLoanRepayment[]>(`/loans/${loanId}/repayments/`);
}

export async function recordLoanRepayment(
  loanId: string,
  payload: {
    amount: string | number;
    payment_mode: string;
    utr?: string;
    payment_date?: string;
    gateway_reference?: string;
    remarks?: string;
    collection_status?: string;
  },
): Promise<{
  repayment: ApiLoanRepayment;
  loan: ApiLoan;
  collection_status?: string;
  collection_status_display?: string;
  amount_due?: string;
  till_date_amount?: string;
  total_collected?: string;
  lead_status?: string;
  lead_status_display?: string;
}> {
  return apiPost<{
    repayment: ApiLoanRepayment;
    loan: ApiLoan;
    collection_status?: string;
    collection_status_display?: string;
    amount_due?: string;
    till_date_amount?: string;
    total_collected?: string;
    lead_status?: string;
    lead_status_display?: string;
  }>(`/loans/${loanId}/repayments/record/`, payload);
}

type LoanRepaymentResult = {
  repayment: ApiLoanRepayment;
  loan: ApiLoan;
  collection_status?: string;
  collection_status_display?: string;
  amount_due?: string;
  till_date_amount?: string;
  total_collected?: string;
  lead_status?: string;
  lead_status_display?: string;
};

export async function updateLoanRepayment(
  loanId: string,
  repaymentId: string,
  payload: {
    amount?: string | number;
    payment_mode?: string;
    utr?: string;
    payment_date?: string;
    gateway_reference?: string;
    remarks?: string;
    collection_status?: string;
  },
): Promise<LoanRepaymentResult> {
  return apiPatch<LoanRepaymentResult>(
    `/loans/${loanId}/repayments/${repaymentId}/update/`,
    payload,
  );
}

export async function deleteLoanRepayment(
  loanId: string,
  repaymentId: string,
): Promise<{
  repayment_id: string;
  lead_status?: string;
  lead_status_display?: string;
}> {
  return apiDelete<{
    repayment_id: string;
    lead_status?: string;
    lead_status_display?: string;
  }>(`/loans/${loanId}/repayments/${repaymentId}/delete/`);
}
