import { Link } from 'react-router-dom';
import { FaqAccordion } from '@/components/FaqAccordion';
import { CtaBanner } from '@/components/CtaBanner';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { companyInfo } from '@/data/company';
import type { LoanProductConfig } from '@/data/loan-products';
import { faqPageSchema, financialServiceSchema, localBusinessSchema } from '@/lib/seo-schemas';

interface LoanProductPageViewProps {
  product: LoanProductConfig;
}

const productHeroImages: Record<string, string> = {
  'personal-loan': '/personal-loan/personal-loan-1.svg',
  'business-loan': '/business-loan/business-loan-1.svg',
  'home-loan': '/home-loan/home-loan-1.svg',
  'education-loan': '/personal-loan/personal-loan-2.svg',
  'msme-loan': '/business-loan/business-loan-2.svg',
  'loan-against-property': '/home-loan/home-loan-2.svg',
  'medical-emergency-loan': '/medical-emergency-loan/medical-emergency-loan-1.svg',
  'salary-advance-loan': '/salary-advance-loan/salary-advance-loan-1.svg',
  'travel-loan': '/travel-loan/travel-1.svg',
  'shopping-loan': '/shopping-loan/shopping-1.svg',
  'home-renovation-loan': '/home-renovation/home-renovation-1.svg',
};

function getProductHeroImage(slug: string) {
  return productHeroImages[slug] ?? '/personal-loan/personal-loan-1.svg';
}

export function LoanProductPageView({ product }: LoanProductPageViewProps) {
  const faqItems = product.faqs.map((faq, index) => ({
    id: `${product.slug}-faq-${index}`,
    question: faq.question,
    answer: faq.answer,
    category: product.name,
  }));

  const schemas = [
    financialServiceSchema(),
    faqPageSchema(faqItems),
    ...(product.city ? [localBusinessSchema(product.city)] : []),
  ];

  const heroImage = getProductHeroImage(product.slug);

  return (
    <>
      <JsonLd data={schemas} />

      <PageHero
        eyebrow={`About ${product.name}`}
        title={product.headline}
        description={
          product.slug === 'personal-loan' ? (
            <>
              {product.intro} Fully digital and collateral-free loans from {companyInfo.loanAmountMin}{' '}
              to {companyInfo.loanAmountMax} with a repayment tenure of {companyInfo.tenureRange}.
              Interest rate: {companyInfo.interestMonthly}. APR: {companyInfo.aprRange}. Processing
              fee: {companyInfo.processingFee}. Minimal documentation and terms disclosed upfront.
            </>
          ) : (
            product.intro
          )
        }
        image={heroImage}
        imageAlt={`${product.name} illustration`}
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {product.highlights.map((item) => (
              <div key={item} className="card text-sm font-medium text-primary-deep">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-12 space-y-10">
            {product.sections.map((section) => (
              <article key={section.heading}>
                <h2 className="text-2xl font-bold text-primary-deep">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className="mt-4 leading-relaxed text-mid-shade">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}
          </div>

          <div className="mt-12">
            <SectionHeader
              eyebrow="Explore more"
              title="Related loan products"
              description="Browse related options and tools that may fit your next funding need."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {product.relatedSlugs.map((slug) => (
                <Link
                  key={slug}
                  to={`/${slug}`}
                  className="rounded-full border border-card-border px-4 py-2 text-sm font-medium text-primary-deep hover:bg-bg-app"
                >
                  {slug.replace(/-/g, ' ')}
                </Link>
              ))}
              <Link
                to="/emi-calculator"
                className="rounded-full border border-card-border px-4 py-2 text-sm font-medium text-primary-deep hover:bg-bg-app"
              >
                EMI calculator
              </Link>
            </div>
          </div>

          <div className="mt-12">
            <SectionHeader
              eyebrow="Need answers?"
              title="Frequently asked questions"
              description="Clear answers on eligibility, documents, and repayment for this product."
            />
            <div className="mt-6">
              <FaqAccordion items={faqItems} />
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        title={`Ready to apply for a ${product.name.toLowerCase()}?`}
        description="Submit your application online and our team will contact you with next steps."
      />
    </>
  );
}
