import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, Loader2, Search } from 'lucide-react';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { confirmLoanPayment, fetchActiveLoan, startLoanCheckout, type ActiveLoan } from '@/lib/repaymentApi';
import { formatCurrency } from '@/lib/utils';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

type Step = 'lookup' | 'details';

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function LoanDetailList({ loan }: { loan: ActiveLoan }) {
  const rows = [
    ['Loan no.', loan.loanNo],
    ['Name', loan.name],
    ['Mobile no.', loan.mobile],
    ['Email id', loan.email],
    ['Payable amount', formatCurrency(loan.payableAmount)],
  ] as const;

  return (
    <dl className="divide-y divide-card-border rounded-2xl border border-card-border bg-white">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:px-5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-light-gray">{label}</dt>
          <dd className="text-sm font-semibold text-primary-deep md:text-base">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoanRepaymentPage() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loan, setLoan] = useState<ActiveLoan | null>(null);
  const [step, setStep] = useState<Step>('lookup');
  const [returnMessage, setReturnMessage] = useState<string | null>(null);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('order_id');
    if (!orderId) return;
    confirmLoanPayment(orderId)
      .then(() => {
        setReturnMessage('Payment received. It is waiting for the accounts team to approve it in the CRM.');
      })
      .catch((confirmError: unknown) => {
        setReturnMessage(
          confirmError instanceof Error ? confirmError.message : 'Payment is not confirmed yet.',
        );
      });
  }, []);

  async function onFetch(event: FormEvent) {
    event.preventDefault();
    const mobile = normalizeMobile(mobileNumber);
    if (!INDIAN_MOBILE.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      setLoan(null);
      setStep('lookup');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setLoan(await fetchActiveLoan(mobile));
      setStep('details');
    } catch (fetchError) {
      setLoan(null);
      setStep('lookup');
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load the loan.');
    } finally {
      setLoading(false);
    }
  }

  async function onPay() {
    const mobile = normalizeMobile(mobileNumber);
    setPaying(true);
    setError(null);
    try {
      window.location.assign(await startLoanCheckout(mobile));
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : 'Could not start payment.');
      setPaying(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Repayment"
        title="Loan repayment"
        description="Enter the mobile number on the loan to see the amount due, then pay the active loan on Cashfree."
        image="/personal-loan/personal-loan-3.svg"
        imageAlt="Person reviewing a loan repayment on a phone"
        chips={['Mobile lookup', 'Active loan', 'Cashfree']}
        actions={
          <a href="#repayment-form" className="btn-primary">
            Fetch loan details
          </a>
        }
      />

      <section id="repayment-form" className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          {step === 'lookup' ? (
            <>
              <SectionHeader
                eyebrow="Lookup"
                title="Find your active loan"
                description="Use the mobile number registered on the loan."
              />
              <form
                onSubmit={onFetch}
                className="mt-8 grid gap-4 rounded-2xl border border-card-border bg-bg-app/60 p-5 sm:grid-cols-[1fr_auto] sm:items-end md:p-6"
              >
                <div>
                  <label htmlFor="repay-mobile" className="label-field">
                    Mobile number
                  </label>
                  <input
                    id="repay-mobile"
                    name="mobile_number"
                    className="input-field"
                    placeholder="10-digit mobile"
                    value={mobileNumber}
                    onChange={(event) => setMobileNumber(normalizeMobile(event.target.value))}
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fetching
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Fetch loan details
                    </>
                  )}
                </button>
              </form>
              {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
              {returnMessage ? <p className="mt-4 text-sm text-primary-deep">{returnMessage}</p> : null}
            </>
          ) : null}

          {step === 'details' && loan ? (
            <>
              <SectionHeader
                eyebrow="Active loan"
                title="Loan details"
                description="This is the running loan with cash pending. Pay now opens Cashfree for the amount due."
              />
              <div className="mt-8 space-y-5">
                <LoanDetailList loan={loan} />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" className="btn-primary" disabled={paying} onClick={onPay}>
                    {paying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening Cashfree
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pay now
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setStep('lookup');
                      setLoan(null);
                    }}
                  >
                    Search again
                  </button>
                </div>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
