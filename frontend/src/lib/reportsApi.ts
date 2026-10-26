import { apiGet } from '@/lib/api';

/** Dropdown values for branch/state filters on All Reporting. */
export interface ReportingFilters {
  branches: string[];
  states: string[];
}

export interface DisbursedReportRow {
  id: string;
  customerId: string;
  leadId: string;
  loanNo: string;
  name: string;
  dob: string;
  gender: string;
  pan: string;
  adharCard: string;
  mob: string;
  email: string;
  branch: string;
  credBy: string;
  pdBy: string;
  employed: string;
  monthlyIncome: string;
  monthlyObligation: string;
  loanAmt: string;
  tenure: string;
  roi: string;
  repayDate: string;
  disbursalDate: string;
  recidanceType: string;
  accountNo: string;
  bankIfsc: string;
  bankName: string;
  accountType: string;
  beneficiaryBranch: string;
  checkNo: string;
  enachDetails: string;
  disbursalRefNo: string;
  companyAccount: string;
  processingFee: string;
  tax: string;
  cibil: string;
  utm: string;
  state: string;
  redFlag: string;
  pdType: string;
  disbursedAmount: string;
  ckycNo: string;
  loanType: string;
  leadCategory: string;
  customerLeadCount: number;
  status: string;
  leadComingDate: string;
}

export interface CollectionReportRow {
  id: string;
  repaymentId: string;
  customerId: string;
  leadId: string;
  loanNo: string;
  branch: string;
  name: string;
  email: string;
  mob: string;
  pan: string;
  state: string;
  repayDate: string;
  collectedAmount: string;
  loanAmount: string;
  repayAmount: string;
  excessAmount: string;
  principalAmt: string;
  interestAmt: string;
  penalInterest: string;
  collectedMode: string;
  referenceNo: string;
  waveOff: string;
  settelmentAmt: string;
  collectionSource: string;
  collectionTeam: string;
  status: string;
  remarks: string;
  collectionDateTime: string;
  collectionDate: string;
  collectionTime: string;
}

export interface CibilReportRow {
  id: string;
  customerId: string;
  leadId: string;
  loanNo: string;
  name: string;
  dob: string;
  gender: string;
  pan: string;
  adharCard: string;
  mob: string;
  email: string;
  address: string;
  addressCategory: string;
  addressType: string;
  state: string;
  pinCode: string;
  disbursalDate: string;
  repayDate: string;
  tenure: string;
  roi: string;
  loanAmt: string;
  repayAmt: string;
  accountNo: string;
  ifscCode: string;
  bankBranch: string;
  bankName: string;
  cibilScore: string;
}

/** Server-side filters: date range follows the tab's own date (disbursal / collection). */
export interface ReportFilterParams {
  date_from?: string;
  date_to?: string;
  branch?: string;
  search?: string;
}

export interface ReportQuery extends ReportFilterParams {
  page?: number;
  page_size?: number;
}

function applyReportFilters(query: URLSearchParams, params?: ReportFilterParams) {
  if (params?.date_from) query.set('date_from', params.date_from);
  if (params?.date_to) query.set('date_to', params.date_to);
  if (params?.branch && params.branch !== 'All') query.set('branch', params.branch);
  if (params?.search?.trim()) query.set('search', params.search.trim());
}

/** Paginated reporting API envelope ({ count, results }). */
export interface PaginatedReportRows<T> {
  count: number;
  results: T[];
}

export async function fetchReportingFilters(): Promise<ReportingFilters> {
  return apiGet<ReportingFilters>('/reports/filters/');
}

/** Disbursed-loan reporting rows for the active page (GET /reports/disbursed/). */
export async function fetchDisbursedReportRows(params?: ReportQuery): Promise<PaginatedReportRows<DisbursedReportRow>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  applyReportFilters(query, params);
  const qs = query.toString();
  return apiGet<PaginatedReportRows<DisbursedReportRow>>(`/reports/disbursed/${qs ? `?${qs}` : ''}`);
}

/** Collection repayment rows for the active page (GET /reports/collection/). */
export async function fetchCollectionReportRows(params?: ReportQuery): Promise<PaginatedReportRows<CollectionReportRow>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  applyReportFilters(query, params);
  const qs = query.toString();
  return apiGet<PaginatedReportRows<CollectionReportRow>>(`/reports/collection/${qs ? `?${qs}` : ''}`);
}

/** CIBIL export rows for the active page (GET /reports/cibil/). */
export async function fetchCibilReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedReportRows<CibilReportRow>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiGet<PaginatedReportRows<CibilReportRow>>(`/reports/cibil/${qs ? `?${qs}` : ''}`);
}

async function fetchAllReportPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedReportRows<T>>,
): Promise<T[]> {
  const pageSize = 100;
  const rows: T[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    const batch = await fetchPage(page, pageSize);
    total = batch.count;
    rows.push(...batch.results);
    if (batch.results.length === 0 || rows.length >= total) {
      break;
    }
    page += 1;
  }

  return rows;
}

/** Load every CIBIL row (paginated API) for client-side report filters/export. */
export async function fetchAllCibilReportRows(): Promise<CibilReportRow[]> {
  return fetchAllReportPages((page, page_size) => fetchCibilReportRows({ page, page_size }));
}

/** Load every disbursed reporting row for export (table stays paginated). */
export async function fetchAllDisbursedReportRows(
  filters?: ReportFilterParams,
): Promise<DisbursedReportRow[]> {
  return fetchAllReportPages((page, page_size) =>
    fetchDisbursedReportRows({ ...filters, page, page_size }),
  );
}

/** Load every collection reporting row for export (table stays paginated). */
export async function fetchAllCollectionReportRows(
  filters?: ReportFilterParams,
): Promise<CollectionReportRow[]> {
  return fetchAllReportPages((page, page_size) =>
    fetchCollectionReportRows({ ...filters, page, page_size }),
  );
}
