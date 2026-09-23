import { format } from 'date-fns';
import { apiGet } from '@/lib/api';
import type { BranchMetric, Sanction, SanctionFreshRepeat } from '@/types';
import type { DashboardDateFilter, DashboardDateRange } from '@/features/dashboard/dashboardFilterUtils';

interface ApiSanctionRow {
  id: string;
  officer: string;
  target: number;
  achievement: number;
  percentage: number;
  deficit: number;
}

interface ApiBranchRow {
  id: string;
  branch: string;
  target: number;
  achievement: number;
  percentage: number;
  deficit: number;
}

interface ApiFreshRepeatRow {
  id: string;
  officer: string;
  fresh_cases: number;
  fresh_loan_amount: number;
  repeat_cases: number;
  repeat_loan_amount: number;
  grand_total_cases: number;
  grand_total_amount: number;
}

interface ApiDashboardTablesResponse {
  period_label: string;
  date_from: string;
  date_to: string;
  sanctions: ApiSanctionRow[];
  branches: ApiBranchRow[];
  fresh_repeat: ApiFreshRepeatRow[];
}

export interface DashboardTablesResponse {
  period_label: string;
  date_from: string;
  date_to: string;
  sanctions: Sanction[];
  branches: BranchMetric[];
  fresh_repeat: SanctionFreshRepeat[];
}

function mapSanction(row: ApiSanctionRow): Sanction {
  return {
    id: row.id,
    leadId: '',
    officer: row.officer,
    target: row.target,
    achievement: row.achievement,
    percentage: row.percentage,
    deficit: row.deficit,
  };
}

function mapBranch(row: ApiBranchRow): BranchMetric {
  return {
    id: row.id,
    branch: row.branch,
    target: row.target,
    achievement: row.achievement,
    percentage: row.percentage,
    deficit: row.deficit,
  };
}

function mapFreshRepeat(row: ApiFreshRepeatRow): SanctionFreshRepeat {
  return {
    id: row.id,
    officer: row.officer,
    freshCases: row.fresh_cases,
    freshLoanAmount: row.fresh_loan_amount,
    repeatCases: row.repeat_cases,
    repeatLoanAmount: row.repeat_loan_amount,
    grandTotalCases: row.grand_total_cases,
    grandTotalAmount: row.grand_total_amount,
  };
}

export async function fetchDashboardTables(
  period: DashboardDateFilter,
  dateRange: DashboardDateRange,
): Promise<DashboardTablesResponse> {
  const params = new URLSearchParams({ period });
  if (period === 'Custom' && dateRange.from && dateRange.to) {
    params.set('date_from', format(dateRange.from, 'yyyy-MM-dd'));
    params.set('date_to', format(dateRange.to, 'yyyy-MM-dd'));
  }
  const data = await apiGet<ApiDashboardTablesResponse>(`/dashboard/tables/?${params.toString()}`);
  return {
    period_label: data.period_label,
    date_from: data.date_from,
    date_to: data.date_to,
    sanctions: data.sanctions.map(mapSanction),
    branches: data.branches.map(mapBranch),
    fresh_repeat: data.fresh_repeat.map(mapFreshRepeat),
  };
}
