import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { brand } from '@/lib/brand';
import { companyInfo } from '@/data/company';

export function AboutTeaser() {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="overflow-hidden rounded-2xl border border-card-border bg-bg-app">
          <div className="grid items-center lg:grid-cols-2">
            <div className="p-6 md:p-8 lg:p-10">
              <SectionHeader
                eyebrow="About us"
                title={companyInfo.welcomeTitle}
                description={companyInfo.teaserBody}
              />
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-primary-deep">
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-card-border">
                  APR {companyInfo.aprRange}
                </span>
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-card-border">
                  Tenure {companyInfo.tenureRange}
                </span>
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-card-border">
                  No pre-closure charges
                </span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-deep px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                >
                  Read more
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-mid-shade">
                  <ShieldCheck className="h-4 w-4 text-accent-teal" />
                  CIN - {brand.cin}
                </p>
              </div>
            </div>

            <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden bg-gradient-to-br from-primary-deep/5 via-accent-teal/10 to-accent-indigo/10 p-6 md:min-h-[300px] lg:min-h-full">
              <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent-teal/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-44 w-44 rounded-full bg-accent-indigo/20 blur-2xl" />

              <img
                src="/personal-loan/personal-loan-1.svg"
                alt="Digital personal loan with Kuberniti Money"
                className="hero-float relative z-10 w-full max-w-[280px] drop-shadow-xl md:max-w-[320px]"
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
              />

              <div className="absolute bottom-5 left-5 z-20 hidden rounded-xl border border-white/60 bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm sm:block">
                <p className="text-[11px] font-medium text-mid-shade">Loan range</p>
                <p className="text-sm font-bold text-primary-deep">
                  {companyInfo.loanAmountMin} – {companyInfo.loanAmountMax}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
