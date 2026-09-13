export const MIN_LEAD_MONTHLY_INCOME = 40000;

export function validateNewLeadFinancials(
  monthlyIncome: string | number,
  requiredAmount: string | number,
): string | null {
  const income = Number(monthlyIncome);
  const required = Number(requiredAmount);

  if (!monthlyIncome || Number.isNaN(income) || income <= 0) {
    return 'Monthly income is required.';
  }
  if (income < MIN_LEAD_MONTHLY_INCOME) {
    return `Monthly income must be at least ${MIN_LEAD_MONTHLY_INCOME}.`;
  }
  if (!requiredAmount || Number.isNaN(required) || required <= 0) {
    return 'Loan required amount is mandatory.';
  }
  if (required >= income) {
    return 'Required loan amount must be less than monthly income.';
  }
  return null;
}
