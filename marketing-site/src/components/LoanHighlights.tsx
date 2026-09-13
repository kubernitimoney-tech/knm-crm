import { Link } from 'react-router-dom';
import { Zap, Eye, Users, Headphones, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { cn } from '@/lib/utils';

const highlights = [
  {
    icon: Zap,
    title: 'Fast application',
    description: 'Apply in minutes from your phone — no lengthy paperwork to start.',
    accent: 'teal',
  },
  {
    icon: Eye,
    title: 'Transparent terms',
    description: 'Clear repayment schedules and fees disclosed before you commit.',
    accent: 'indigo',
  },
  {
    icon: Users,
    title: 'For salaried professionals',
    description: 'Designed for stable-income earners who need short-term funds.',
    accent: 'teal',
  },
  {
    icon: Headphones,
    title: 'Support when it matters',
    description: 'Medical emergencies, weddings, bills — our team is here to help.',
    accent: 'indigo',
  },
] as const;

const proofs = [
  '100% online process',
  'Collateral-free loans',
  'Key Fact Statement upfront',
  'No pre-closure charges',
] as const;

export function LoanHighlights() {
  return (
    <section className="relative overflow-hidden bg-bg-app py-12 md:py-16">
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-accent-teal/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-64 w-64 rounded-full bg-accent-indigo/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <SectionHeader
              eyebrow="Why choose us"
              title="Why Kuberniti Money?"
              description="Responsible lending with a customer-first approach — built for salaried professionals who need clear terms and quick support."
            />

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {proofs.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-primary-deep ring-1 ring-card-border"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-teal" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/apply"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent-indigo hover:underline"
            >
              Apply in minutes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-accent-teal/15 to-accent-indigo/15 blur-sm" />
            <div className="relative overflow-hidden rounded-2xl border border-card-border bg-white p-5 shadow-sm md:p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent-teal/15 blur-2xl" />
              <img
                src="/salary-advance-loan/salary-advance-loan-2.svg"
                alt="Quick and transparent personal loans"
                className="hero-float relative mx-auto w-full max-w-[220px] drop-shadow-md"
                width={220}
                height={220}
                loading="lazy"
                decoding="async"
              />
              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-bg-app px-3 py-2.5">
                  <p className="text-[11px] text-mid-shade">Disbursal</p>
                  <p className="text-sm font-semibold text-primary-deep">Few minutes*</p>
                </div>
                <div className="rounded-xl bg-bg-app px-3 py-2.5">
                  <p className="text-[11px] text-mid-shade">Process</p>
                  <p className="text-sm font-semibold text-primary-deep">Fully digital</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <article
              key={item.title}
              className="group rounded-2xl border border-card-border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm',
                  item.accent === 'teal' ? 'bg-accent-teal' : 'bg-accent-indigo',
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-primary-deep">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mid-shade">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
