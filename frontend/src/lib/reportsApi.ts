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
  leadCategory: string;
  customerLeadCount: number;
  status: string;
  leadComingDate: string;
}

export interface CollectionReportRow {
  id: string;
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

/** Paginated reporting API envelope ({ count, results }). */
export interface PaginatedReportRows<T> {
  count: number;
  results: T[];
}

export async function fetchReportingFilters(): Promise<ReportingFilters> {
  return apiGet<ReportingFilters>('/reports/filters/');
}

/** Disbursed-loan reporting rows for the active page (GET /reports/disbursed/). */
export async function fetchDisbursedReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedReportRows<DisbursedReportRow>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiGet<PaginatedReportRows<DisbursedReportRow>>(`/reports/disbursed/${qs ? `?${qs}` : ''}`);
}

/** Collection repayment rows for the active page (GET /reports/collection/). */
export async function fetchCollectionReportRows(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedReportRows<CollectionReportRow>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
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

/** Load every CIBIL row (paginated API) for client-side report filters/export. */
export async function fetchAllCibilReportRows(): Promise<CibilReportRow[]> {
  const pageSize = 100;
  const rows: CibilReportRow[] = [];
  let page = 1;
  let total = 0;

  do {
    const batch = await fetchCibilReportRows({ page, page_size: pageSize });
    total = batch.count;
    rows.push(...batch.results);
    page += 1;
  } while (rows.length < total);

  return rows;
}
