import { Link } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import { brand } from '@/lib/brand';

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-primary-deep md:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-primary-deep">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Public host shown in legal copy (prefer production domain from env). */
function siteHost() {
  try {
    const url = brand.siteUrl.includes('localhost')
      ? 'https://kubernitimoney.com'
      : brand.siteUrl;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'kubernitimoney.com';
  }
}

export function TermsPage() {
  const host = siteHost();

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms & Conditions"
        description={
          <>
            Usage policy for {brand.name}. By using our website and services you agree to these terms.
          </>
        }
        image="/personal-loan/personal-loan-2.svg"
        imageAlt="Terms and conditions"
        actions={
          <>
            <Link to="/privacy" className="btn-secondary">
              Privacy Policy
            </Link>
            <Link to="/contact" className="btn-secondary">
              Contact Us
            </Link>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl space-y-10 px-4 text-sm leading-relaxed text-mid-shade md:px-6 md:text-[15px]">
          <PolicySection title="Usage Policy">
            <p>
              By accessing and using www.{host}, whether as a registered user or a guest, you agree to comply
              with these Terms and Conditions (&ldquo;Usage Policy&rdquo;). These terms, along with any additional
              policies referenced herein, govern your use of the website and services provided by {brand.name}.
            </p>
            <p>
              The website is owned and operated by {brand.name}, an entity duly registered under applicable
              Indian laws. References to &ldquo;{brand.name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
              &ldquo;our&rdquo; shall include this entity and its associated online platforms.
            </p>
            <p>
              This document is an electronic record under the Information Technology Act, 2000 and applicable
              rules. It does not require physical or digital signatures and is published in compliance with the
              IT (Intermediary Guidelines) Rules, 2011.
            </p>
            <p>
              {brand.name} reserves the right to modify these Terms and Conditions at any time. Continued use of
              the website constitutes acceptance of the updated terms.
            </p>
          </PolicySection>

          <PolicySection title="Eligibility Requirements">
            <BulletList
              items={[
                'Users must be legally competent to enter into a contract under the Indian Contract Act, 1872.',
                'Minors (below 18 years) are not eligible to use the services.',
                'Users must be at least 18 years old and legally capable of entering a binding contract.',
                'An active Indian savings or current bank account is mandatory.',
                'A valid PAN issued by the Income Tax Department of India is required.',
                'Users acknowledge the risks involved in lending and borrowing.',
              ]}
            />
          </PolicySection>

          <PolicySection title="Borrower Criteria">
            <BulletList
              items={[
                'The borrower must be a salaried individual.',
                'Must be an Indian resident.',
                'Must not have been unemployed in the last six months.',
                'No ongoing civil or criminal litigation.',
                'Salary must be credited to a registered bank account.',
                'Loan amount eligibility: INR 25,000 to INR 5,00,000.',
                'Maximum loan tenure: 24 months.',
              ]}
            />
          </PolicySection>

          <PolicySection title="Sign-Up and Registration">
            <p>
              Users may access the website as registered users or guests. Certain features are restricted to
              registered users only.
            </p>
            <p>
              By registering, users authorize {brand.name} to perform identity verification, KYC checks, credit
              bureau checks, and employment/residential verification.
            </p>
            <p>
              {brand.name} reserves the right to suspend or terminate accounts if any information provided is
              false, incomplete, or outdated.
            </p>
            <p>Registration on {brand.name} is completely free of charge.</p>
          </PolicySection>

          <PolicySection title="Use of the Website">
            <BulletList
              items={[
                'Users must log in to apply for a loan.',
                'Users are responsible for safeguarding their login credentials.',
                'Any fraudulent activity must be reported immediately.',
                'Unauthorized use may result in termination of access.',
                'Website availability may be affected due to maintenance or unforeseen issues.',
              ]}
            />
          </PolicySection>

          <PolicySection title="Lending Process">
            <BulletList
              items={[
                'Loan applications are submitted online.',
                'Document requirements are shared via email.',
                'Tele-caller verification and document validation are conducted.',
                'Home verification, Video KYC, E-Sign, and E-Mandate are mandatory.',
                'Loan disbursement is usually completed within 15–20 minutes after approval.',
              ]}
            />
          </PolicySection>

          <PolicySection title="Repayment and Settlement">
            <BulletList
              items={[
                'Loan repayment tenure is generally 30–35 days.',
                'Timely repayment results in a No Objection Certificate (NOC).',
                'Delayed payments may attract a daily penalty of 0.25%.',
                'Settlement and installment requests are evaluated case by case.',
              ]}
            />
          </PolicySection>

          <PolicySection title="Fraud Alert">
            <p>
              {brand.name} does not ask for prepayments for loan approval. Users should report any suspicious
              communication immediately.
            </p>
          </PolicySection>

          <PolicySection title="Limitation of Liability">
            <p>
              Services are provided on an &ldquo;as-is&rdquo; basis. {brand.name} is not liable for data loss,
              service interruptions, or unauthorized access due to user negligence.
            </p>
          </PolicySection>

          <PolicySection title="Governing Law &amp; Jurisdiction">
            <p>
              These Terms and Conditions are governed by Indian laws. All disputes shall be subject to the
              exclusive jurisdiction of courts in Delhi, India.
            </p>
          </PolicySection>

          <PolicySection title="Connect and Communication">
            <p>
              To communicate with you, we may use your information to respond to your inquiries, provide
              customer service support, send you important information about the services, and send you
              marketing communications (with your consent) via different channels, including but not limited to
              SMS, Email, WhatsApp, and Voice.
            </p>
          </PolicySection>

          <PolicySection title="Contact Information">
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-primary-deep">Recovery Manager Email:</span> ———
              </li>
              <li>
                <span className="font-medium text-primary-deep">Recovery Team Email:</span> ———
              </li>
              <li>
                <span className="font-medium text-primary-deep">Settlement Email:</span> ———
              </li>
              <li>
                <span className="font-medium text-primary-deep">Support Email:</span>{' '}
                <a href={`mailto:${brand.supportEmail}`} className="font-medium text-primary-deep hover:underline">
                  {brand.supportEmail}
                </a>
              </li>
            </ul>
          </PolicySection>

          <div className="flex flex-wrap gap-3 border-t border-card-border pt-8">
            <Link to="/privacy" className="btn-secondary !px-5 !py-2.5 text-sm">
              Privacy Policy
            </Link>
            <Link to="/" className="btn-secondary !px-5 !py-2.5 text-sm">
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
