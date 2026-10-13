import blogSeo from '@/data/blog-seo.json';
import { companyInfo } from '@/data/company';
import type { FaqItem } from '@/data/faq';
import { brand } from '@/lib/brand';
import { absoluteUrl, normalizePath } from '@/lib/seo';

export interface BreadcrumbItem {
  label: string;
  path: string;
}

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/apply': 'Apply',
  '/personal-loan': 'Personal Loan',
  '/business-loan': 'Business Loan',
  '/home-loan': 'Home Loan',
  '/education-loan': 'Education Loan',
  '/gold-loan': 'Gold Loan',
  '/loan-against-property': 'Loan Against Property',
  '/msme-loan': 'MSME Loan',
  '/vehicle-loan': 'Vehicle Loan',
  '/personal-loan-delhi': 'Personal Loan Delhi',
  '/personal-loan-mumbai': 'Personal Loan Mumbai',
  '/personal-loan-bangalore': 'Personal Loan Bangalore',
  '/personal-loan-hyderabad': 'Personal Loan Hyderabad',
  '/emi-calculator': 'EMI Calculator',
  '/cibil-score': 'CIBIL Score',
  '/track': 'Track Application',
  '/loan-repayment': 'Loan Repayment',
  '/blog': 'Blog',
  '/testimonials': 'Customer Stories',
  '/faq': 'FAQ',
  '/about': 'About',
  '/contact': 'Contact',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms & Conditions',
};

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const path = normalizePath(pathname);
  if (path === '/') return [{ label: 'Home', path: '/' }];

  if (path.startsWith('/blog/')) {
    const blogMeta = (blogSeo as { path: string; title: string }[]).find((entry) => entry.path === path);
    return [
      { label: 'Home', path: '/' },
      { label: 'Blog', path: '/blog' },
      { label: blogMeta?.title.split('|')[0]?.trim() || 'Article', path },
    ];
  }

  return [
    { label: 'Home', path: '/' },
    { label: ROUTE_LABELS[path] || 'Page not found', path },
  ];
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/og-image.png'),
    email: brand.supportEmail,
    telephone: brand.supportPhone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: companyInfo.streetAddress,
      addressLocality: companyInfo.addressLocality,
      addressRegion: companyInfo.addressRegion,
      postalCode: companyInfo.postalCode,
      addressCountry: 'IN',
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

export function financialServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: brand.name,
    url: absoluteUrl('/'),
    description: brand.tagline,
    areaServed: 'India',
    serviceType: [
      'Personal Loan',
      'Business Loan',
      'Home Loan',
      'Education Loan',
      'Gold Loan',
      'Loan Against Property',
      'MSME Loan',
      'Vehicle Loan',
    ],
    email: brand.supportEmail,
    telephone: brand.supportPhone,
  };
}

export function localBusinessSchema(city: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `${brand.name} — ${city}`,
    url: absoluteUrl('/'),
    telephone: brand.supportPhone,
    email: brand.supportEmail,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressCountry: 'IN',
    },
    areaServed: city,
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.name,
    url: absoluteUrl('/'),
    description: brand.tagline,
    publisher: {
      '@type': 'Organization',
      name: brand.name,
    },
  };
}

export function breadcrumbSchema(crumbs: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function articleSchema({
  title,
  description,
  slug,
  publishedAt,
}: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: publishedAt,
    author: {
      '@type': 'Organization',
      name: brand.name,
    },
    publisher: {
      '@type': 'Organization',
      name: brand.name,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/og-image.png'),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${slug}`),
  };
}
