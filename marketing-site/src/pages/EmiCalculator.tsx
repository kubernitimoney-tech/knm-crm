import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CtaBanner } from '@/components/CtaBanner';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { faqPageSchema, financialServiceSchema } from '@/lib/seo-schemas';
import { cn } from '@/lib/utils';

const GST_RATE = 0.18;

type LoanMode = 'standard' | 'payday';

type LoanTypeOption = {
  id: string;
  label: string;
  mode: LoanMode;
};

const LOAN_TYPES: LoanTypeOption[] = [
  { id: 'personal', label: 'Personal Loan', mode: 'standard' },
  { id: 'travel', label: 'Travel Loan', mode: 'standard' },
  { id: 'shopping', label: 'Shopping Loan', mode: 'standard' },
  { id: 'emergency', label: 'Emergency Loan', mode: 'standard' },
  { id: 'clear-bills', label: 'Clear Bills Loan', mode: 'standard' },
  { id: 'home-renovation', label: 'Home Renovation', mode: 'standard' },
  { id: 'salary-advance', label: 'Salary Advance', mode: 'standard' },
  { id: 'payday', label: 'Payday Loan', mode: 'payday' },
];

const STANDARD = {
  amount: { min: 10_000, max: 200_000, step: 1_000, default: 50_000 },
  rate: { min: 15, max: 35, step: 1, default: 24 },
  tenure: { min: 3, max: 12, step: 1, default: 6 },
  fee: { min: 0, max: 10, step: 0.1, default: 2 },
} as const;

const PAYDAY = {
  amount: { min: 5_000, max: 150_000, step: 500, default: 25_000 },
  rate: { min: 0.5, max: 1, step: 0.05, default: 0.75 },
  tenure: { min: 7, max: 40, step: 1, default: 15 },
  fee: { min: 5, max: 10, step: 0.1, default: 5 },
} as const;

function clampToStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / step);
  const snapped = Number((min + steps * step).toFixed(4));
  return Math.min(max, Math.max(min, snapped));
}

function calculateEmi(principal: number, annualRate: number, tenureMonths: number) {
  if (!principal || !tenureMonths) return 0;
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  return (
    (principal * monthlyRate * (1 + monthlyRate) ** tenureMonths) /
    ((1 + monthlyRate) ** tenureMonths - 1)
  );
}

function formatInr(value: number, digits = 0) {
  return value.toLocaleString('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label htmlFor={id} className="label-field mb-0">
          {label}
        </label>
        <span className="rounded-lg bg-bg-app px-2.5 py-1 text-sm font-semibold text-primary-deep ring-1 ring-card-border">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-field"
      />
      <div className="mt-1 flex justify-between text-[11px] text-light-gray">
        <span>{typeof min === 'number' && min >= 100 ? `₹${formatInr(min)}` : min}</span>
        <span>{typeof max === 'number' && max >= 100 ? `₹${formatInr(max)}` : max}</span>
      </div>
    </div>
  );
}

export function EmiCalculatorPage() {
  const [loanTypeId, setLoanTypeId] = useState('personal');
  const loanType = LOAN_TYPES.find((item) => item.id === loanTypeId) ?? LOAN_TYPES[0];
  const isPayday = loanType.mode === 'payday';
  const config = isPayday ? PAYDAY : STANDARD;

  const [amount, setAmount] = useState<number>(STANDARD.amount.default);
  const [rate, setRate] = useState<number>(STANDARD.rate.default);
  const [tenure, setTenure] = useState<number>(STANDARD.tenure.default);
  const [feePercent, setFeePercent] = useState<number>(STANDARD.fee.default);

  useEffect(() => {
    const next = LOAN_TYPES.find((item) => item.id === loanTypeId)?.mode === 'payday' ? PAYDAY : STANDARD;
    setAmount(next.amount.default);
    setRate(next.rate.default);
    setTenure(next.tenure.default);
    setFeePercent(next.fee.default);
  }, [loanTypeId]);

  const result = useMemo(() => {
    const principal = clampToStep(amount, config.amount.min, config.amount.max, config.amount.step);
    const interestRate = clampToStep(rate, config.rate.min, config.rate.max, config.rate.step);
    const term = clampToStep(tenure, config.tenure.min, config.tenure.max, config.tenure.step);
    const feePct = clampToStep(feePercent, config.fee.min, config.fee.max, config.fee.step);

    const processingFee = (principal * feePct) / 100;
    const gst = processingFee * GST_RATE;
    const totalFees = processingFee + gst;
    const netDisbursal = Math.max(0, principal - totalFees);

    if (isPayday) {
      const interest = (principal * interestRate * term) / 100;
      const totalPayable = principal + interest;
      return {
        mode: 'payday' as const,
        principal,
        interestRate,
        term,
        feePct,
        processingFee,
        gst,
        totalFees,
        netDisbursal,
        interest,
        totalPayable,
        emi: 0,
        totalInterest: interest,
      };
    }

    const emi = calculateEmi(principal, interestRate, term);
    const totalPayable = emi * term;
    const totalInterest = Math.max(0, totalPayable - principal);

    return {
      mode: 'standard' as const,
      principal,
      interestRate,
      term,
      feePct,
      processingFee,
      gst,
      totalFees,
      netDisbursal,
      interest: totalInterest,
      totalPayable,
      emi,
      totalInterest,
    };
  }, [amount, rate, tenure, feePercent, config, isPayday]);

  const faqs = [
    {
      id: 'emi-1',
      question: 'How is EMI calculated for personal-style loans?',
      answer:
        'EMI uses principal, annual interest rate, and tenure in months. Processing fee plus 18% GST is shown separately and typically deducted from disbursal.',
      category: 'EMI',
    },
    {
      id: 'emi-2',
      question: 'How does payday loan interest work?',
      answer:
        'Payday loans use a daily rate of interest for the selected tenure in days. Total payable is principal plus daily interest for the full tenure.',
      category: 'EMI',
    },
  ];

  return (
    <>
      <JsonLd data={[financialServiceSchema(), faqPageSchema(faqs)]} />
      <PageHero
        eyebrow="Planning tool"
        title="EMI Calculator"
        description="Choose a loan type, adjust amount, rate, tenure, and fees — see repayment estimates instantly."
        image="/common/calculator.svg"
        imageAlt="EMI Calculator illustration"
        chips={['Personal & payday', 'Fee + GST included', 'Instant estimate']}
        actions={
          <>
            <a href="#emi-calculator" className="btn-primary">
              Start calculating
            </a>
            <Link to="/apply" className="btn-secondary">
              Apply Now
            </Link>
          </>
        }
      />

      <section id="emi-calculator" className="scroll-mt-20 bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div className="card-compact space-y-5">
              <div>
                <label htmlFor="loan_type" className="label-field">
                  Loan type
                </label>
                <select
                  id="loan_type"
                  className="input-field"
                  value={loanTypeId}
                  onChange={(event) => setLoanTypeId(event.target.value)}
                >
                  {LOAN_TYPES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <RangeField
                id="loan_amount"
                label="Loan amount"
                value={amount}
                min={config.amount.min}
                max={config.amount.max}
                step={config.amount.step}
                display={`₹${formatInr(amount)}`}
                onChange={setAmount}
              />

              <RangeField
                id="loan_rate"
                label={isPayday ? 'Daily interest rate' : 'Annual interest rate'}
                value={rate}
                min={config.rate.min}
                max={config.rate.max}
                step={config.rate.step}
                display={isPayday ? `${rate.toFixed(2)}% / day` : `${rate}% p.a.`}
                onChange={setRate}
              />

              <RangeField
                id="loan_tenure"
                label={isPayday ? 'Tenure (days)' : 'Tenure (months)'}
                value={tenure}
                min={config.tenure.min}
                max={config.tenure.max}
                step={config.tenure.step}
                display={isPayday ? `${tenure} days` : `${tenure} months`}
                onChange={setTenure}
              />

              <RangeField
                id="processing_fee"
                label="Processing fee (+ 18% GST)"
                value={feePercent}
                min={config.fee.min}
                max={config.fee.max}
                step={config.fee.step}
                display={`${feePercent.toFixed(1)}%`}
                onChange={(value) =>
                  setFeePercent(clampToStep(value, config.fee.min, config.fee.max, config.fee.step))
                }
              />
            </div>

            <div className="card-compact flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-deep">
                {loanType.label} estimate
              </p>
              <p className="mt-2 text-sm text-mid-shade">
                {isPayday ? 'Total amount payable' : 'Estimated monthly EMI'}
              </p>
              <p className="mt-1 text-4xl font-bold text-primary-deep">
                ₹{formatInr(isPayday ? result.totalPayable : result.emi)}
              </p>

              <dl className="mt-6 space-y-3 border-t border-card-border/80 pt-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mid-shade">Loan amount</dt>
                  <dd className="font-semibold text-primary-deep">₹{formatInr(result.principal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mid-shade">Processing fee (incl. 18% GST)</dt>
                  <dd className="font-semibold text-primary-deep">₹{formatInr(result.totalFees)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mid-shade">Net disbursal</dt>
                  <dd className="font-semibold text-primary-deep">₹{formatInr(result.netDisbursal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mid-shade">{isPayday ? 'Interest' : 'Total interest'}</dt>
                  <dd className="font-semibold text-primary-deep">₹{formatInr(result.interest)}</dd>
                </div>
                {!isPayday ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-mid-shade">Total payable</dt>
                    <dd className="font-semibold text-primary-deep">
                      ₹{formatInr(result.totalPayable)}
                    </dd>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-mid-shade">Tenure</dt>
                    <dd className="font-semibold text-primary-deep">{result.term} days</dd>
                  </div>
                )}
              </dl>

              <p className="mt-5 text-xs leading-relaxed text-light-gray">
                Estimates only. Final terms depend on eligibility, credit assessment, and approved offer.
                Processing fee + GST is typically deducted from disbursal.
              </p>

              <Link to="/apply" className="btn-primary mt-6 inline-flex w-full justify-center sm:w-auto">
                Apply for a loan
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {LOAN_TYPES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLoanTypeId(option.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  loanTypeId === option.id
                    ? 'bg-primary-deep text-white'
                    : 'bg-white text-mid-shade ring-1 ring-card-border hover:text-primary-deep',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <article className="mt-12 space-y-4 leading-relaxed text-mid-shade">
            <SectionHeader
              eyebrow="Smart borrowing"
              title="How to use calculator results wisely"
              description="Compare repayment against your monthly income and existing obligations before you apply."
            />
            <p>
              Shorter tenures raise the EMI but reduce total interest. Longer tenures ease monthly cash
              flow but usually increase lifetime borrowing cost.
            </p>
            <p>
              For payday loans, daily interest compounds over the selected days — keep tenure as short as
              you can comfortably repay. Always review processing fee and GST impact on net disbursal.
            </p>
          </article>
        </div>
      </section>
      <CtaBanner />
    </>
  );
}
