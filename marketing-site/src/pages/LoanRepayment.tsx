import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, Search, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { formatCurrency } from '@/lib/utils';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

interface ActiveLoan {
  loanNo: string;
  name: string;
  mobile: string;
  email: string;
  payableAmount: number;
}

type Step = 'lookup' | 'details' | 'pay' | 'paid';

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

/** Sample loan until the repayment API is connected. Any valid mobile returns one active loan. */
function sampleActiveLoan(mobile: string): ActiveLoan {
  return {
    loanNo: 'LN000128',
    name: 'Rahul Sharma',
    mobile,
    email: 'rahul.sharma@example.com',
    payableAmount: 28750,
  };
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
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    setLoan(sampleActiveLoan(mobile));
    setStep('details');
    setLoading(false);
  }

  async function onPay() {
    setPaying(true);
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    setPaying(false);
    setStep('paid');
  }

  return (
    <>
      <PageHero
        eyebrow="Repayment"
        title="Loan repayment"
        description="Enter the mobile number on the loan to see the amount due. Online payment will be connected shortly. This screen uses sample loan details."
        image="/personal-loan/personal-loan-3.svg"
        imageAlt="Person reviewing a loan repayment on a phone"
        chips={['Mobile lookup', 'Active loan', 'Sample payment']}
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
            </>
          ) : null}

          {step === 'details' && loan ? (
            <>
              <SectionHeader
                eyebrow="Active loan"
                title="Loan details"
                description="Sample details for this mobile number. Pay now opens a demo payment screen."
              />
              <div className="mt-8 space-y-5">
                <LoanDetailList loan={loan} />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" className="btn-primary" onClick={() => setStep('pay')}>
                    <CreditCard className="h-4 w-4" />
                    Pay now
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
              </div>
            </>
          ) : null}

          {step === 'pay' && loan ? (
            <>
              <SectionHeader
                eyebrow="Payment"
                title="Pay your loan"
                description="Demo only. No amount is charged and Cashfree is not called yet."
              />
              <div className="mt-8 space-y-5">
                <LoanDetailList loan={loan} />
                <div className="rounded-2xl border border-card-border bg-bg-app/70 p-5">
                  <p className="text-sm text-mid-shade">Amount to pay</p>
                  <p className="mt-1 text-3xl font-bold text-primary-deep">
                    {formatCurrency(loan.payableAmount)}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" className="btn-primary" disabled={paying} onClick={onPay}>
                    {paying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pay {formatCurrency(loan.payableAmount)}
                      </>
                    )}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setStep('details')}>
                    Back to loan details
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {step === 'paid' && loan ? (
            <div className="rounded-2xl border border-card-border bg-bg-app/70 p-6 md:p-8">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary-deep" />
                <div>
                  <h2 className="text-xl font-bold text-primary-deep">Payment recorded (demo)</h2>
                  <p className="mt-2 text-sm leading-relaxed text-mid-shade">
                    {formatCurrency(loan.payableAmount)} for loan {loan.loanNo} was not sent to a
                    payment gateway. This confirmation is only a preview.
                  </p>
                  <Link to="/contact" className="btn-secondary mt-5 inline-flex">
                    Contact support
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
