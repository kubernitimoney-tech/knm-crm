import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { FaqAccordion } from '@/components/FaqAccordion';
import { FaqImageCarousel } from '@/components/FaqImageCarousel';
import { CtaBanner } from '@/components/CtaBanner';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { brand } from '@/lib/brand';
import { faqItems } from '@/data/faq';
import { faqPageSchema } from '@/lib/seo-schemas';
import { cn } from '@/lib/utils';

const ALL = 'All';

export function FaqPage() {
  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(faqItems.map((item) => item.category)))],
    [],
  );
  const [activeCategory, setActiveCategory] = useState(ALL);

  const filteredItems = useMemo(
    () =>
      activeCategory === ALL
        ? faqItems
        : faqItems.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  return (
    <>
      <JsonLd data={faqPageSchema(faqItems)} />

      <PageHero
        eyebrow="Help center"
        title="Frequently asked questions"
        description="Everything you need to know about eligibility, documents, repayment, fees, and more — clear answers before you apply."
        chips={[`${faqItems.length} questions`, 'Updated answers', 'Transparent terms']}
        media={<FaqImageCarousel className="hero-float w-full max-w-[300px] md:max-w-[360px]" />}
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

      <section className="relative overflow-hidden bg-bg-app py-12 md:py-16">
        <div className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-accent-indigo/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-accent-teal/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((category) => {
              const isActive = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-primary-deep text-white'
                      : 'bg-white text-mid-shade ring-1 ring-card-border hover:text-primary-deep',
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-card-border bg-white p-5 shadow-sm">
                <FaqImageCarousel compact />
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-bg-app px-3 py-2.5">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-accent-indigo" />
                  <p className="text-xs leading-relaxed text-mid-shade">
                    Browse by category or open any question for a clear answer.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-card-border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary-deep">
                  <Headphones className="h-4 w-4 text-accent-teal" />
                  <p className="text-sm font-semibold">Still need help?</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-mid-shade">
                  Our support team can guide you on eligibility, documents, and repayment.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-secondary-dark"
                  >
                    Contact support
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href={`mailto:${brand.supportEmail}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-card-border px-4 py-2.5 text-sm font-semibold text-primary-deep hover:bg-bg-app"
                  >
                    Email us
                  </a>
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-light-gray">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent-teal" />
                  Clear answers before you apply
                </p>
              </div>
            </aside>

            <div>
              <p className="mb-3 text-sm text-mid-shade">
                Showing{' '}
                <span className="font-semibold text-primary-deep">{filteredItems.length}</span>{' '}
                {filteredItems.length === 1 ? 'question' : 'questions'}
                {activeCategory !== ALL ? (
                  <>
                    {' '}
                    in <span className="font-semibold text-primary-deep">{activeCategory}</span>
                  </>
                ) : null}
              </p>
              <FaqAccordion
                key={activeCategory}
                items={filteredItems}
                defaultOpen={filteredItems[0]?.id}
              />
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        title="Ready to apply with clarity?"
        description="Review the terms, apply online, and our team will guide you through the next steps."
      />
    </>
  );
}
