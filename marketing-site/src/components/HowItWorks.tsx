import { Link } from 'react-router-dom';
import { FileText, SearchCheck, BadgeCheck, Banknote, ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { cn } from '@/lib/utils';

const steps = [
  {
    icon: FileText,
    title: 'Apply online',
    description: 'Fill a short form in minutes from your phone — no branch visit needed.',
    time: '2 mins',
  },
  {
    icon: SearchCheck,
    title: 'Quick verification',
    description: 'Our team verifies your details and documents with a transparent process.',
    time: 'Same day',
  },
  {
    icon: BadgeCheck,
    title: 'Get approved',
    description: 'Receive a clear offer with repayment terms explained upfront.',
    time: 'Clear terms',
  },
  {
    icon: Banknote,
    title: 'Funds disbursed',
    description: 'Approved amount credited to your bank account — typically within a few minutes.',
    time: 'Few minutes',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-white py-12 md:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          eyebrow="Simple process"
          title="How it works"
          description="Four clear steps from apply to disbursal — built for busy salaried professionals."
          action={
            <Link
              to="/apply"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-indigo hover:underline"
            >
              Start application
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {/* Desktop connector line */}
          <div
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-8 hidden h-0.5 bg-gradient-to-r from-accent-teal via-accent-indigo to-primary-deep lg:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex h-full flex-col rounded-2xl border border-card-border bg-bg-app/60 p-5 transition-colors hover:border-accent-indigo/30 hover:bg-bg-app lg:mx-2 lg:border-transparent lg:bg-transparent lg:p-4 lg:hover:border-transparent lg:hover:bg-transparent">
                <div className="relative z-10 mb-4 flex items-center gap-3 lg:flex-col lg:items-start lg:gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ring-4 ring-white',
                      index % 2 === 0 ? 'bg-accent-teal' : 'bg-accent-indigo',
                    )}
                  >
                    <step.icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="lg:hidden">
                    <p className="text-xs font-bold text-light-gray">
                      Step {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="font-semibold text-primary-deep">{step.title}</h3>
                  </div>
                </div>

                <div className="hidden lg:block">
                  <p className="text-xs font-bold tracking-wide text-light-gray">
                    STEP {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-primary-deep">{step.title}</h3>
                </div>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-mid-shade">
                  {step.description}
                </p>

                <span
                  className={cn(
                    'mt-4 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold',
                    index % 2 === 0
                      ? 'bg-accent-teal/10 text-accent-teal'
                      : 'bg-accent-indigo/10 text-accent-indigo',
                  )}
                >
                  {step.time}
                </span>
              </div>

              {/* Mobile / tablet arrow between cards */}
              {index < steps.length - 1 ? (
                <div
                  className="flex justify-center py-1 text-lighter-gray sm:hidden"
                  aria-hidden="true"
                >
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
