import { Link } from 'react-router-dom';
import { Shield, Heart, Users, Scale, Lightbulb, Target, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { brand } from '@/lib/brand';
import { companyInfo } from '@/data/company';

type Pillar = {
  icon: LucideIcon;
  label: string;
  description: string;
  ring: string;
  text: string;
  rotate: string;
};

const pillars: Pillar[] = [
  {
    icon: Lightbulb,
    label: 'Vision',
    description:
      "To be India's most trusted name in short-term lending — where every salaried professional can access fair, instant credit without stress.",
    ring: 'border-red-500',
    text: 'text-red-500',
    rotate: 'rotate-[35deg]',
  },
  {
    icon: Target,
    label: 'Mission',
    description:
      "To deliver quick personal loans with transparent terms and genuine human support, bridging the gap between paydays and life's unexpected moments.",
    ring: 'border-blue-500',
    text: 'text-blue-500',
    rotate: 'rotate-[200deg]',
  },
  {
    icon: BarChart3,
    label: 'Value',
    description:
      'Responsible lending, complete transparency, and a customer-first mindset guide every decision — no hidden fees, no false promises.',
    ring: 'border-amber-500',
    text: 'text-amber-500',
    rotate: 'rotate-[160deg]',
  },
];

const values = [
  {
    icon: Shield,
    title: 'Responsible lending',
    description:
      'We assess every application carefully and offer amounts that align with your repayment capacity.',
  },
  {
    icon: Heart,
    title: 'Customer-first process',
    description:
      'From application to disbursal, our team guides you with clear communication at every step.',
  },
  {
    icon: Users,
    title: 'Built for salaried Indians',
    description:
      'Our products are designed for working professionals who need short-term funds between paydays.',
  },
  {
    icon: Scale,
    title: 'Transparent terms',
    description:
      'No hidden surprises. Fees, interest, and repayment schedules are disclosed upfront.',
  },
];

const highlights = [
  { label: 'Loan amount', value: `${companyInfo.loanAmountMin} – ${companyInfo.loanAmountMax}` },
  { label: 'Tenure', value: companyInfo.tenureRange },
  { label: 'Interest', value: companyInfo.interestMonthly },
  { label: 'APR', value: companyInfo.aprRange },
  { label: 'Processing fee', value: companyInfo.processingFee },
  { label: 'Pre-closure', value: 'No charges' },
] as const;

export function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={`About ${brand.name}`}
        title={companyInfo.welcomeTitle}
        description={
          <>
            <p>{companyInfo.welcomeBody}</p>
            <p className="mt-3 text-sm">
              Operated by{' '}
              <span className="font-semibold text-primary-deep">{brand.legalEntity}</span>
              {' | '}
              CIN - <span className="font-semibold text-primary-deep">{brand.cin}</span>
            </p>
          </>
        }
        image="/personal-loan/personal-loan-3.svg"
        imageAlt="Transparent digital lending with Kuberniti Money"
        chips={['100% online', 'Collateral-free', 'Minimal docs']}
        actions={
          <>
            <Link to="/apply" className="btn-primary">
              Apply Now
            </Link>
            <Link to="/contact" className="btn-secondary">
              Contact Us
            </Link>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-card-border bg-bg-app px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-light-gray">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary-deep">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Our foundation"
            title="Vision, mission & values"
            description="The principles that shape how we build products and serve every customer."
          />

          <div className="mt-14 grid gap-12 sm:grid-cols-2 md:mt-16 md:grid-cols-3 md:gap-8">
            {pillars.map((pillar) => (
              <div key={pillar.label} className="flex flex-col items-center text-center">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full border-[7px] border-b-transparent ${pillar.ring} ${pillar.rotate}`}
                  />
                  <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-white shadow-[0_12px_30px_rgba(42,45,79,0.12)] ring-1 ring-card-border">
                    <pillar.icon className={`h-11 w-11 ${pillar.text}`} strokeWidth={1.75} />
                  </div>
                </div>
                <h3 className={`mt-6 text-xl font-bold ${pillar.text}`}>{pillar.label}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-mid-shade">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <SectionHeader
                eyebrow="Why we exist"
                title="Our mission"
                description="Kuberniti Money exists to make short-term personal loans accessible, transparent, and stress-free for salaried professionals across India. We understand that life does not always align with your payday — medical emergencies, wedding expenses, bill payments, and other commitments can arise when you least expect them."
              />
              <p className="mt-4 max-w-lg leading-relaxed text-mid-shade">
                Our mission is to provide quick access to funds with clear terms and trusted support,
                so you can focus on what matters most. We believe in responsible lending — never
                overpromising, always putting our customers first.
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <img
                src="/common/mission-1.svg"
                alt="Our mission at Kuberniti Money"
                className="hero-float h-auto w-full max-w-[320px] bg-transparent object-contain md:max-w-[380px]"
                width={380}
                height={380}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
              <img
                src="/common/responsibility-1.svg"
                alt="Responsible lending commitment at Kuberniti Money"
                className="hero-float h-auto w-full max-w-[320px] bg-transparent object-contain md:max-w-[380px]"
                width={380}
                height={380}
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="order-1 lg:order-2">
              <SectionHeader
                eyebrow="How we lend"
                title="Responsible lending commitment"
                description="We evaluate each application based on repayment capacity, income stability, and documentation quality. Our advisors explain applicable fees, interest, tenure, and repayment obligations before you accept an offer. We encourage customers to borrow only what they need and maintain timely EMIs to protect long-term financial health."
              />
              <p className="mt-4 max-w-lg leading-relaxed text-mid-shade">
                Kuberniti Money invests in clear communication, digital convenience, and human
                support so customers across India can access credit without confusion. Whether you
                are applying from Delhi, Mumbai, Bangalore, Hyderabad, or any other city, our goal
                remains the same: transparent lending with respect and accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Our values"
            title="What we stand for"
            description="The standards we hold ourselves to in every customer conversation and credit decision."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="card flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep/10 text-primary-deep">
                  <v.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-deep">{v.title}</h3>
                  <p className="mt-1 text-sm text-mid-shade">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
