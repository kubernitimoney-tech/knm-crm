import { Link } from 'react-router-dom';
import { Copyright } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { brand } from '@/lib/brand';
import { companyInfo } from '@/data/company';

const productLinks = [
  { to: '/personal-loan', label: 'Personal Loan' },
  { to: '/business-loan', label: 'Business Loan' },
  { to: '/home-loan', label: 'Home Loan' },
  { to: '/education-loan', label: 'Education Loan' },
  { to: '/gold-loan', label: 'Gold Loan' },
  { to: '/loan-against-property', label: 'Loan Against Property' },
];

const resourceLinks = [
  { to: '/emi-calculator', label: 'EMI Calculator' },
  { to: '/cibil-score', label: 'CIBIL Score Guide' },
  { to: '/track', label: 'Track Application' },
  { to: '/blog', label: 'Blog' },
  { to: '/faq', label: 'FAQ' },
  { to: '/apply', label: 'Apply' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
];

export function Footer() {
  return (
    <footer
      data-surface="dark"
      className="border-t border-card-border bg-primary-deep text-lighter-gray"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo variant="light" />
            <p className="mt-4 text-sm leading-relaxed">{brand.tagline}</p>
            <p className="mt-3 text-xs leading-relaxed text-light-gray">
              Operated by {brand.legalEntity} | CIN - {brand.cin}
            </p>
          </div>

          <div className="min-w-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Loan Products</h2>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Resources</h2>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Support</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${brand.supportEmail}`} className="break-words hover:text-white">
                  {brand.supportEmail}
                </a>
              </li>
              <li>
                <a href={`tel:${brand.supportPhone}`} className="break-words hover:text-white">
                  {brand.supportPhone}
                </a>
              </li>
              <li>{companyInfo.addressLine}</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-secondary-dark pt-8 text-xs md:flex-row">
          <p className="inline-flex items-center gap-1.5">
            <Copyright className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {brand.copyrightYear} {brand.legalEntity} | CIN - {brand.cin}
            </span>
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white">
              Terms &amp; Conditions
            </Link>
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
