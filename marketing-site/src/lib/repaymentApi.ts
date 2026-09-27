const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ActiveLoan {
  loanId: string;
  loanNo: string;
  name: string;
  mobile: string;
  email: string;
  payableAmount: number;
}

interface LookupPayload {
  loan_id: string;
  loan_no: string;
  customer_name: string;
  mobile: string;
  email: string;
  payable_amount: string;
  checkout_url?: string;
}

async function postRepayment(path: string, mobile: string): Promise<LookupPayload> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: LookupPayload;
  };
  if (!response.ok) {
    throw new Error(body.message || 'Could not load the loan.');
  }
  if (!body.data) {
    throw new Error('Could not load the loan.');
  }
  return body.data;
}

function toLoan(data: LookupPayload): ActiveLoan {
  return {
    loanId: data.loan_id,
    loanNo: data.loan_no,
    name: data.customer_name,
    mobile: data.mobile,
    email: data.email,
    payableAmount: Number(data.payable_amount),
  };
}

export async function fetchActiveLoan(mobile: string): Promise<ActiveLoan> {
  return toLoan(await postRepayment('/leads/public/repayments/lookup/', mobile));
}

export async function confirmLoanPayment(orderId: string): Promise<void> {
  const response = await fetch(`${apiBase}/leads/public/repayments/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message || 'Payment is not confirmed yet.');
  }
}

export async function startLoanCheckout(mobile: string): Promise<string> {
  const data = await postRepayment('/leads/public/repayments/checkout/', mobile);
  if (!data.checkout_url) {
    throw new Error('Cashfree did not return a checkout page.');
  }
  return data.checkout_url;
}
