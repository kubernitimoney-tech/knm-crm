import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  FileText,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { brand } from '@/lib/brand';
import { companyInfo } from '@/data/company';
import { cn } from '@/lib/utils';

function whatsappDigits() {
  return brand.whatsappNumber.replace(/\D/g, '');
}

function whatsappDisplay() {
  const digits = whatsappDigits();
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

function whatsappHref() {
  const text = encodeURIComponent(`Hi ${brand.name}, I need help with a loan.`);
  return `https://wa.me/${whatsappDigits()}?text=${text}`;
}

const helpTopics = [
  {
    icon: HelpCircle,
    title: 'Eligibility & documents',
    description: 'Ask about income criteria, KYC papers, PAN/Aadhaar, or salary proof requirements.',
  },
  {
    icon: FileText,
    title: 'Application status',
    description: 'Track every enquiry online with your PAN or mobile, or share your reference ID with support.',
  },
  {
    icon: MessageCircle,
    title: 'Repayment & fees',
    description: 'Clarify EMI schedules, processing fee + GST, tenure options, or pre-closure terms.',
  },
] as const;

export function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get in touch"
        title="Contact us"
        description="Have questions about eligibility, documents, or your application? Our support team is here to help salaried customers across India."
        image="/clear-bills/clear-bills-1.svg"
        imageAlt="Contact Kuberniti Money support"
        chips={['Email & WhatsApp', 'Mon–Sat 9 AM–6 PM', 'Fast callback']}
        actions={
          <>
            <Link to="/apply" className="btn-primary">
              Apply Now
            </Link>
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Support"
            title="Reach our team"
            description="Pick the channel that suits you. We typically respond within business hours — email and WhatsApp are the fastest for most queries."
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContactCard
              icon={Mail}
              title="Email"
              content={brand.supportEmail}
              detail="Best for documents, detailed queries, and written confirmation."
              href={`mailto:${brand.supportEmail}`}
            />
            <ContactCard
              icon={WhatsAppIcon}
              title="WhatsApp"
              content={whatsappDisplay()}
              detail="Quick chat for eligibility checks and application guidance."
              href={whatsappHref()}
              external
              accent="whatsapp"
            />
            <ContactCard
              icon={Phone}
              title="Phone"
              content={brand.supportPhone}
              detail="Call during support hours for live assistance."
              href={`tel:${brand.supportPhone}`}
            />
            <ContactCard
              icon={Clock}
              title="Support hours"
              content="Mon – Sat, 9:00 AM – 6:00 PM IST"
              detail="Closed on Sundays and public holidays."
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ContactCard
              icon={MapPin}
              title="Registered office"
              content={companyInfo.addressLine}
              detail="Digital-first lending — apply online from anywhere in India."
            />
            <div className="card-compact flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-dark">
                Before you write to us
              </p>
              <p className="mt-2 text-sm leading-relaxed text-mid-shade">
                Include your full name, registered mobile number, and application reference ID (if you
                already applied). That helps us respond faster without asking for the same details again.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="How we help"
            title="What you can contact us about"
            description="These are the most common reasons customers reach out — we are happy to help with any of them."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {helpTopics.map((topic) => (
              <div key={topic.title} className="rounded-2xl border border-card-border bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep/10 text-primary-deep">
                  <topic.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-primary-deep">{topic.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mid-shade">{topic.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/track"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-deep hover:underline"
            >
              Track application
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/faq"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-deep hover:underline"
            >
              Browse FAQ
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/emi-calculator"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-deep hover:underline"
            >
              Try EMI Calculator
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="card-compact grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <SectionHeader
              eyebrow="Next step"
              title="Ready to apply?"
              description="Skip the wait — submit a short online application. Our team will contact you with verification steps and clear loan terms."
            />
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link to="/apply" className="btn-primary">
                Apply Now
              </Link>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2"
              >
                <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                Ask on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        eyebrow="Still unsure?"
        title="Talk to us before you apply"
        description="Our advisors explain eligibility, documents, and fees upfront — so you can borrow with clarity."
      />
    </>
  );
}

function ContactCard({
  icon: Icon,
  title,
  content,
  detail,
  href,
  external = false,
  accent = 'default',
}: {
  icon: LucideIcon | typeof WhatsAppIcon;
  title: string;
  content: string;
  detail?: string;
  href?: string;
  external?: boolean;
  accent?: 'default' | 'whatsapp';
}) {
  return (
    <div className="card-compact flex gap-4">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          accent === 'whatsapp'
            ? 'bg-[#25D366]/15 text-[#25D366]'
            : 'bg-primary-deep/10 text-primary-deep',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-primary-deep">{title}</h2>
        {href ? (
          <a
            href={href}
            className="mt-1 block break-words text-sm font-medium text-primary-deep hover:underline"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {content}
          </a>
        ) : (
          <p className="mt-1 text-sm font-medium text-primary-deep">{content}</p>
        )}
        {detail ? <p className="mt-1.5 text-xs leading-relaxed text-mid-shade">{detail}</p> : null}
      </div>
    </div>
  );
}
