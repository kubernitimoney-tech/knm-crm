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

function PolicySubheading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-primary-deep">{children}</h3>;
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

export function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description={
          <>
            How {brand.name} collects, uses, stores, and protects your information when you use our website
            and application.
          </>
        }
        image="/personal-loan/personal-loan-1.svg"
        imageAlt="Privacy and data protection"
        actions={
          <>
            <Link to="/terms" className="btn-secondary">
              Terms &amp; Conditions
            </Link>
            <Link to="/contact" className="btn-secondary">
              Contact Us
            </Link>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl space-y-10 px-4 text-sm leading-relaxed text-mid-shade md:px-6 md:text-[15px]">
          <div className="space-y-4">
            <p>
              This Privacy Policy governs the manner in which {brand.name}, a sub-brand of Har Shreeji Finance and
              Leasing Company Ltd., collects, uses, stores, and discloses information collected from users (each, a
              &ldquo;User&rdquo;) of the {brand.name} website and mobile/web application (collectively referred to as
              the &ldquo;Platform&rdquo;).
            </p>
            <p>
              This Policy is published in accordance with Rule 4(1) of the Information Technology (Reasonable Security
              Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 under the Information
              Technology Act, 2000.
            </p>
            <p>By accessing or using our Platform and Services, you consent to the terms of this Privacy Policy.</p>
          </div>

          <PolicySection title="1. Information We Collect">
            <div className="space-y-5">
              <div className="space-y-2">
                <PolicySubheading>A. Personal Data</PolicySubheading>
                <p>
                  We collect personally identifiable information to provide our Services efficiently, including but
                  not limited to:
                </p>
                <BulletList
                  items={[
                    'Full name, contact number, email address',
                    'Government-issued IDs (PAN, Aadhaar, etc.)',
                    'Income details, employment information',
                    'Location data, reference list, and device metadata',
                  ]}
                />
              </div>

              <div className="space-y-2">
                <PolicySubheading>B. Account Information</PolicySubheading>
                <p>When signing in via third-party platforms (e.g., Google, Facebook), we collect your:</p>
                <BulletList items={['Email address', 'Name and profile picture', 'Authentication token (ASID)']} />
                <p>This data is used solely for login and user identification purposes.</p>
              </div>

              <div className="space-y-2">
                <PolicySubheading>C. Usage and Log Data</PolicySubheading>
                <p>We may automatically collect:</p>
                <BulletList
                  items={[
                    'IP address, device name and type',
                    'Operating system version, app settings, usage timestamps',
                    'Diagnostic and crash information',
                  ]}
                />
                <p>This helps us identify issues and improve app performance and security.</p>
              </div>
            </div>
          </PolicySection>

          <PolicySection title="2. Permissions and Device Access">
            <div className="space-y-5">
              <div className="space-y-2">
                <PolicySubheading>A. Location &amp; Device Details</PolicySubheading>
                <p>We collect GPS and network-based location to:</p>
                <BulletList
                  items={[
                    'Evaluate credit eligibility',
                    'Offer customized loan services',
                    'Prevent fraud and enhance security',
                  ]}
                />
              </div>

              <div className="space-y-2">
                <PolicySubheading>B. Contact Access (Historical)</PolicySubheading>
                <p>
                  For app versions [Insert Version] and below, limited contact data (name and number) was collected
                  for risk assessment. For versions [Insert Version] and above, we no longer collect this data.
                </p>
              </div>

              <div className="space-y-2">
                <PolicySubheading>C. Storage Access</PolicySubheading>
                <p>Required to enable the upload/download of KYC and supporting documents securely.</p>
              </div>

              <div className="space-y-2">
                <PolicySubheading>D. Camera Access</PolicySubheading>
                <p>Used for real-time scanning and submission of official documents (e.g., PAN, Aadhaar).</p>
              </div>
            </div>
          </PolicySection>

          <PolicySection title="3. Purpose of Data Collection">
            <p>Your data is collected, processed, and used for:</p>
            <BulletList
              items={[
                'Performing KYC and credit risk analysis',
                'Verifying identity and detecting fraud',
                'Administering, improving, and customizing our Platform',
                'Sending service notifications, updates, and promotional offers (with consent)',
                'Compliance with legal and regulatory obligations',
              ]}
            />
          </PolicySection>

          <PolicySection title="4. Data Protection and Security">
            <p>
              We maintain appropriate technical and organizational security measures as per ISO/IEC 27001 standards
              and IT Rules, 2011, including:
            </p>
            <BulletList
              items={[
                'Encrypted storage and transmission',
                'Restricted access controls',
                'Periodic security audits',
              ]}
            />
            <p>
              However, no method of electronic storage or transmission is entirely secure. Users are advised to
              exercise caution while sharing data.
            </p>
          </PolicySection>

          <PolicySection title="5. Cookies">
            <p>
              We may use third-party services that deploy cookies or similar tracking tools. While we do not use
              cookies directly, such third-party integrations may store cookies on your browser or device for
              analytics or improvements.
            </p>
            <p>You may control cookies through your browser settings.</p>
          </PolicySection>

          <PolicySection title="6. External Links">
            <p>
              Our Platform may contain links to third-party websites or services. We do not control or endorse these,
              and are not responsible for their privacy policies or practices.
            </p>
          </PolicySection>

          <PolicySection title="7. Legal Basis and Compliance">
            <p>This Policy complies with:</p>
            <BulletList
              items={[
                'Information Technology Act, 2000',
                'IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011',
                'Other applicable data protection laws in India',
              ]}
            />
            <p>
              We may also cooperate with legal or government authorities in cases of suspected fraud or violations.
            </p>
          </PolicySection>

          <PolicySection title="8. Your Consent">
            <p>By using the Platform and submitting your personal data, you:</p>
            <BulletList
              items={[
                'Consent to its collection, processing, and storage',
                'Authorize us to use your information to deliver services and communicate with you via email, SMS, phone, WhatsApp, RCS, or voice calls',
                'Accept this Privacy Policy in full',
              ]}
            />
          </PolicySection>

          <PolicySection title="9. Policy Updates">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in law or business practices. Any
              changes will be posted on this page with an updated &ldquo;Effective Date.&rdquo;
            </p>
            <p>Users are advised to check this page periodically for updates.</p>
          </PolicySection>

          <PolicySection title="10. Grievance Redressal">
            <p>
              In accordance with Rule 5(9) of the IT Rules, 2011, you may contact our Grievance Officer for any
              concerns regarding your data:
            </p>
            <p>
              Email:{' '}
              <a
                href="mailto:grievance@kubernitimoney.com"
                className="font-medium text-primary-deep hover:underline"
              >
                grievance@kubernitimoney.com
              </a>
            </p>
          </PolicySection>

          <PolicySection title="Note">
            <p>
              Users under the age of 18 are not permitted to use our loan services without parental or legal guardian
              consent.
            </p>
          </PolicySection>

          <div className="flex flex-wrap gap-3 border-t border-card-border pt-8">
            <Link to="/terms" className="btn-secondary !px-5 !py-2.5 text-sm">
              Terms &amp; Conditions
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
