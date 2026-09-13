import { apiGet } from '@/lib/api';

export interface ApiBranch {
  id: string;
  branch_code: string;
  branch_name: string;
  bank_name: string;
  city: string;
  state: string;
  status: string;
}

export async function fetchBranches(): Promise<ApiBranch[]> {
  return apiGet<ApiBranch[]>('/core/branches/');
}

export function resolveBranchName(
  branches: ApiBranch[],
  preferred?: string | null,
): string {
  if (!branches.length) return '';
  if (preferred) {
    const match = branches.find(
      (branch) =>
        branch.branch_name === preferred
        || branch.id === preferred
        || branch.branch_code === preferred,
    );
    if (match) return match.branch_name;
  }
  return branches[0].branch_name;
}
