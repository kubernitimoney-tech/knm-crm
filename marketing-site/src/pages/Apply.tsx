import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Banknote,
  Clock3,
  FileCheck2,
  HandCoins,
  Paintbrush,
  Plane,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Sparkles,
} from 'lucide-react';
import { ApplyForm } from '@/components/ApplyForm';
import { brand } from '@/lib/brand';
import { companyInfo } from '@/data/company';

const loanCategories: { label: string; icon: LucideIcon }[] = [
  { label: 'Shopping', icon: ShoppingCart },
  { label: 'Travel', icon: Plane },
  { label: 'Emergency', icon: Siren },
  { label: 'Personal', icon: HandCoins },
  { label: 'Home', icon: Paintbrush },
  { label: 'Bills', icon: Receipt },
];

const trustPoints = [
  { icon: Clock3, label: '2-minute form' },
  { icon: FileCheck2, label: 'Minimal documents' },
  { icon: Banknote, label: 'Transparent fees' },
  { icon: ShieldCheck, label: 'Secure process' },
] as const;

const steps = [
  { step: '01', title: 'Share details', copy: 'Basic identity & income info' },
  { step: '02', title: 'Quick review', copy: 'Our team verifies eligibility' },
  { step: '03', title: 'Clear offer', copy: 'Terms shown before you proceed' },
] as const;

export function ApplyPage() {
  return (
    <div className="bg-bg-app">
      {/* Brand header band */}
      <section className="relative overflow-hidden bg-primary-deep text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fff 0.8px, transparent 0.8px), radial-gradient(circle at 80% 70%, #fff 0.6px, transparent 0.6px)',
            backgroundSize: '22px 22px, 18px 18px',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-secondary-dark/40 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-lighter-gray ring-1 ring-white/15">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Loan application
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-[2.75rem]">
                Get a personal loan up to{' '}
                <span className="relative inline-block">
                  ₹2 lakh
                  <span className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-white/25" aria-hidden />
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-lighter-gray md:text-base">
                Digital application for salaried professionals. Clear terms, guided support from{' '}
                {brand.name} — subject to eligibility and credit assessment.
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-3 text-center sm:gap-4">
              {[
                { label: 'Amount', value: '₹2L' },
                { label: 'Tenure', value: '3–12 mo' },
                { label: 'Process', value: '100% online' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="min-w-[4.75rem] rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-lighter-gray">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-bold text-white md:text-base">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ul className="mt-7 flex flex-wrap gap-2 md:gap-3">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/10"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-lighter-gray" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[0.92fr_1.18fr] lg:gap-10">
          {/* Left story panel */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-card-border bg-white p-5 shadow-sm md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-dark">
                Why people apply here
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  'Same-day review for complete applications',
                  'No branch visits — apply from your phone',
                  'Repayment options explained before you accept',
                  `Operated by ${brand.legalEntity}`,
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-mid-shade">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-xl bg-bg-app px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-light-gray">
                  Legal entity
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-primary-deep">
                  {brand.legalEntity}
                </p>
                <p className="mt-0.5 text-xs text-mid-shade">CIN - {brand.cin}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-dark">
                Loan for your need
              </p>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
                {loanCategories.map(({ label, icon: Icon }) => (
                  <li
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-card-border bg-white px-2 py-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-deep/25 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep text-white shadow-sm">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-primary-deep sm:text-xs">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {steps.map((item) => (
                <li
                  key={item.step}
                  className="flex items-center gap-3 rounded-2xl border border-card-border bg-white px-3.5 py-3 shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-deep/10 text-xs font-bold text-primary-deep">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-primary-deep">{item.title}</p>
                    <p className="text-xs text-mid-shade">{item.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="text-xs leading-relaxed text-light-gray">
              Typical range {companyInfo.loanAmountMin}–{companyInfo.loanAmountMax} · Tenure{' '}
              {companyInfo.tenureRange} · APR {companyInfo.aprRange}. Final offer subject to
              eligibility.
            </p>
          </aside>

          {/* Form column */}
          <div id="apply-form" className="min-w-0">
            <ApplyForm />
          </div>
        </div>
      </section>
    </div>
  );
}
