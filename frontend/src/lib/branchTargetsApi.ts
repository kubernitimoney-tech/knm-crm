import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export interface ApiBranchTarget {
  id: string;
  branch: string;
  branch_name: string;
  branch_city: string;
  branch_bank: string;
  target_amount: string;
  period_year: number;
  period_month: number;
  created_at: string;
}

export interface BranchTarget {
  id: string;
  branchId: string;
  branchName: string;
  branchCity: string;
  branchBank: string;
  target: number;
  periodYear: number;
  periodMonth: number;
  addedOn: string;
}

export interface BranchTargetPayload {
  branch: string;
  target_amount: number;
  period_year: number;
  period_month: number;
}

function mapBranchTarget(row: ApiBranchTarget): BranchTarget {
  return {
    id: row.id,
    branchId: row.branch,
    branchName: row.branch_name,
    branchCity: row.branch_city,
    branchBank: row.branch_bank,
    target: Number(row.target_amount),
    periodYear: row.period_year,
    periodMonth: row.period_month,
    addedOn: row.created_at,
  };
}

export async function fetchBranchTargets(search?: string): Promise<BranchTarget[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiGet<ApiBranchTarget[]>(`/dashboard/branch-targets/${params}`);
  return data.map(mapBranchTarget);
}

export async function createBranchTarget(payload: BranchTargetPayload): Promise<BranchTarget> {
  const data = await apiPost<ApiBranchTarget>('/dashboard/branch-targets/', payload);
  return mapBranchTarget(data);
}

export async function updateBranchTarget(
  id: string,
  payload: Partial<BranchTargetPayload>,
): Promise<BranchTarget> {
  const data = await apiPatch<ApiBranchTarget>(`/dashboard/branch-targets/${id}/`, payload);
  return mapBranchTarget(data);
}

export async function deleteBranchTarget(id: string): Promise<void> {
  await apiDelete<null>(`/dashboard/branch-targets/${id}/`);
}

export function formatTargetPeriod(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function buildYearOptions(anchorYear = new Date().getFullYear(), span = 2): number[] {
  const years: number[] = [];
  for (let year = anchorYear - span; year <= anchorYear + span; year += 1) {
    years.push(year);
  }
  return years;
}
