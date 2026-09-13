/** Canonical loan purpose labels (A–Z, with Others last). */
export const LOAN_PURPOSE_OPTIONS = [
  'Buying gadgets',
  'Down-payment shortfall',
  'Home interiors',
  'Household fund shortage',
  'Immediate purchase',
  'Loan for paying school fees',
  'Loan repayment',
  'Loan to clear bills',
  'Medical emergency',
  'Meeting immediate commitment',
  'Personal',
  'Travel fund shortage',
  'Wedding',
  'Others',
] as const;

export type LoanPurposeOption = (typeof LOAN_PURPOSE_OPTIONS)[number];

const LEGACY_LOAN_PURPOSE_LABELS: Record<string, LoanPurposeOption> = {
  'Personal Expenses': 'Personal',
  'Debt Consolidation': 'Loan to clear bills',
  'Home Renovation': 'Home interiors',
  Education: 'Loan for paying school fees',
  Other: 'Others',
};

export function normalizeLoanPurpose(value: string | null | undefined): LoanPurposeOption | string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if ((LOAN_PURPOSE_OPTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as LoanPurposeOption;
  }
  return LEGACY_LOAN_PURPOSE_LABELS[trimmed] ?? trimmed;
}
