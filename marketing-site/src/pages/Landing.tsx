import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircleQuestion } from 'lucide-react';
import { Hero } from '@/components/Hero';
import { OurServices } from '@/components/OurServices';
import { HowItWorks } from '@/components/HowItWorks';
import { AboutTeaser } from '@/components/AboutTeaser';
import { LoanHighlights } from '@/components/LoanHighlights';
import { TestimonialsCarousel } from '@/components/TestimonialsCarousel';
import { FaqAccordion } from '@/components/FaqAccordion';
import { FaqImageCarousel } from '@/components/FaqImageCarousel';
import { CtaBanner } from '@/components/CtaBanner';
import { SectionHeader } from '@/components/SectionHeader';
import { JsonLd } from '@/components/JsonLd';
import { testimonials } from '@/data/testimonials';
import { faqItems } from '@/data/faq';
import { faqPageSchema, financialServiceSchema, organizationSchema, websiteSchema } from '@/lib/seo-schemas';

export function LandingPage() {
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), financialServiceSchema(), faqPageSchema(faqItems)]} />
      <Hero />
      <OurServices />
      <HowItWorks />
      <AboutTeaser />
      <LoanHighlights />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Testimonials"
            title="Customer stories"
            description="Real experiences from salaried professionals across India."
            action={
              <Link
                to="/testimonials"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-deep hover:underline"
              >
                View all stories
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />

          <TestimonialsCarousel items={testimonials} />
        </div>
      </section>

      <section className="relative overflow-hidden bg-bg-app py-12 md:py-16">
        <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-accent-indigo/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-accent-teal/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <div>
              <SectionHeader
                accent="indigo"
                eyebrow="Need answers?"
                title="Frequently asked questions"
                description="Quick answers on eligibility, documents, repayment, and fees."
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {['Eligibility', 'Documents', 'Process', 'Fees'].map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-deep ring-1 ring-card-border"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              <div className="relative mt-6 overflow-hidden rounded-2xl border border-card-border bg-white p-4 shadow-sm sm:p-5">
                <FaqImageCarousel compact />
                <div className="relative mt-3 flex items-start gap-2 rounded-xl bg-bg-app px-3 py-2.5">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-accent-indigo" />
                  <p className="text-xs leading-relaxed text-mid-shade">
                    Still unsure? Open the full FAQ or contact support — we are happy to help.
                  </p>
                </div>
              </div>

              <Link
                to="/faq"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-indigo hover:underline"
              >
                View all FAQs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <FaqAccordion items={faqItems.slice(0, 5)} defaultOpen={faqItems[0]?.id} />
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
