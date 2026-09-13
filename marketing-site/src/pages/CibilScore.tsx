import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { faqPageSchema, financialServiceSchema } from '@/lib/seo-schemas';

const faqs = [
  {
    id: 'cibil-1',
    question: 'What is a good CIBIL score for loans?',
    answer:
      'At Kuberniti Money, applicants with a credit score of 640 and above are typically eligible to apply, subject to income, documentation, and credit assessment.',
    category: 'CIBIL',
  },
  {
    id: 'cibil-2',
    question: 'How fast can score improvement show results?',
    answer:
      'Positive repayment behavior usually reflects over several billing cycles. Steady on-time payments matter more than quick fixes.',
    category: 'CIBIL',
  },
];

const scoreFactors = [
  {
    title: 'Payment history',
    description: 'On-time EMIs and card payments carry the most weight. Even one missed due date can pull your score down.',
  },
  {
    title: 'Credit utilization',
    description: 'Using a large share of your card limit signals stress. Keeping balances lower helps protect your score.',
  },
  {
    title: 'Age & mix of credit',
    description: 'Older accounts and a healthy mix of loans/cards show experience managing credit responsibly.',
  },
  {
    title: 'Recent inquiries',
    description: 'Too many loan applications in a short period can look risky. Apply only when you genuinely need funds.',
  },
] as const;

const improvementTips = [
  'Pay every EMI and credit-card bill on or before the due date',
  'Keep card utilization comfortably below your full limit',
  'Avoid applying for multiple loans or cards back-to-back',
  'Check your credit report and dispute any errors quickly',
  'Clear small overdue amounts before starting a new application',
] as const;

export function CibilScorePage() {
  return (
    <>
      <JsonLd data={[financialServiceSchema(), faqPageSchema(faqs)]} />
      <PageHero
        eyebrow="Credit health"
        title="CIBIL Score Guide"
        description="Understand how credit scores affect loan approval, interest rates, and long-term borrowing power."
        image="/common/responsibility-1.svg"
        imageAlt="CIBIL score and responsible credit illustration"
        chips={['640+ preferred', 'On-time EMIs', 'Lower utilization']}
        actions={
          <>
            <Link to="/blog/how-to-improve-cibil-score" className="btn-primary">
              Improvement tips
            </Link>
            <Link to="/apply" className="btn-secondary">
              Apply Now
            </Link>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Why it matters"
            title="Why lenders check your CIBIL score"
            description="Your CIBIL (and other bureau) score is a quick signal of repayment reliability. Lenders use it with income and documents to decide approval, rate, and loan amount."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Approval confidence',
                body: 'A stronger score improves the chance of a smooth yes — especially for salaried personal loans.',
              },
              {
                title: 'Better pricing',
                body: 'Healthier profiles often unlock more competitive interest and clearer offer terms.',
              },
              {
                title: 'Higher eligibility',
                body: 'Stable credit history can support a larger approved amount when income also qualifies.',
              },
            ].map((item) => (
              <div key={item.title} className="card-compact">
                <h3 className="font-semibold text-primary-deep">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mid-shade">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-mid-shade">
            At Kuberniti Money, a score of <span className="font-semibold text-primary-deep">640+</span> is
            generally preferred for application, along with stable salaried income and complete KYC. Final
            offers always depend on full credit assessment.
          </p>
        </div>
      </section>

      <section className="bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Score drivers"
            title="What moves your CIBIL score"
            description="These are the main factors that shape your report. Focus on the ones you can control every month."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {scoreFactors.map((factor) => (
              <div key={factor.title} className="rounded-2xl border border-card-border bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-primary-deep">{factor.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mid-shade">{factor.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <SectionHeader
                eyebrow="Action plan"
                title="Practical ways to improve your score"
                description="Small, consistent habits beat shortcuts. Start with on-time payments — that single change protects your score the most."
              />
              <ul className="mt-6 space-y-3">
                {improvementTips.map((tip) => (
                  <li key={tip} className="flex items-start gap-3 text-sm text-mid-shade">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-compact">
              <SectionHeader
                eyebrow="Before you apply"
                title="Ready your profile for a stronger outcome"
                description="A clean report plus clear salary proof makes verification faster and offers clearer."
              />
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-mid-shade">
                <li>Download your latest credit report and note any overdue or disputed items.</li>
                <li>Clear small dues and confirm upcoming EMIs will not bounce.</li>
                <li>Choose a loan amount you can repay comfortably from monthly income.</li>
                <li>Keep PAN, Aadhaar, and recent salary proof ready for a smooth application.</li>
              </ol>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/blog/how-to-improve-cibil-score" className="btn-secondary">
                  Read full CIBIL guide
                </Link>
                <Link to="/apply" className="btn-primary">
                  Apply for a loan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        eyebrow="Next step"
        title="Score in range? Apply with confidence"
        description="If your CIBIL is 640+ and you are a salaried professional, start a short application — our team will guide the next steps."
      />
    </>
  );
}
