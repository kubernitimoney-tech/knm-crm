export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  sections: { heading: string; paragraphs: string[] }[];
  relatedSlugs: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-improve-cibil-score',
    title: 'How to Improve Your CIBIL Score for Faster Loan Approval',
    excerpt:
      'Practical steps Indian borrowers can take to strengthen credit profile and improve loan eligibility.',
    publishedAt: '2026-01-10',
    sections: [
      {
        heading: 'Why CIBIL score matters',
        paragraphs: [
          'Your CIBIL score influences loan approval, interest rate, and credit limit. Lenders use it to estimate repayment risk.',
          'A stronger score can reduce borrowing cost and improve approval speed for personal, home, and business loans.',
        ],
      },
      {
        heading: 'Steps to improve your score',
        paragraphs: [
          'Pay EMIs and credit card bills on time. Payment history is one of the strongest score drivers.',
          'Keep credit utilization low, avoid frequent hard inquiries, and review your credit report for errors.',
          'Maintain a healthy mix of credit types and retain older accounts when possible to strengthen history length.',
        ],
      },
    ],
    relatedSlugs: ['cibil-score', 'documents-required-personal-loan'],
  },
  {
    slug: 'documents-required-personal-loan',
    title: 'Documents Required for a Personal Loan in India',
    excerpt:
      'A complete checklist of KYC and income documents salaried applicants should prepare before applying.',
    publishedAt: '2026-01-12',
    sections: [
      {
        heading: 'Identity and address proof',
        paragraphs: [
          'Most lenders require PAN and Aadhaar for KYC compliance. Keep scanned copies ready before you apply.',
          'Address proof may be validated through Aadhaar or utility bills depending on lender policy.',
        ],
      },
      {
        heading: 'Income proof for salaried applicants',
        paragraphs: [
          'Recent salary slips and bank statements help lenders verify income stability and repayment capacity.',
          'Having documents organized reduces back-and-forth and speeds up verification.',
        ],
      },
    ],
    relatedSlugs: ['how-to-improve-cibil-score', 'personal-loan-interest-rates'],
  },
  {
    slug: 'emi-calculation-guide',
    title: 'EMI Calculation Guide: Plan Repayments with Confidence',
    excerpt:
      'Learn how EMI is calculated and how tenure and interest rate affect monthly and total repayment.',
    publishedAt: '2026-01-15',
    sections: [
      {
        heading: 'How EMI works',
        paragraphs: [
          'EMI combines principal and interest into a fixed monthly payment across the loan tenure.',
          'Higher interest rates or longer tenures increase total interest paid even if monthly EMI appears affordable.',
        ],
      },
      {
        heading: 'Planning tips',
        paragraphs: [
          'Use an EMI calculator before applying and keep EMIs within a comfortable share of monthly income.',
          'Consider prepayment options and emergency savings so repayments remain stable during income fluctuations.',
        ],
      },
    ],
    relatedSlugs: ['home-loan-eligibility', 'business-loan-eligibility'],
  },
  {
    slug: 'home-loan-eligibility',
    title: 'Home Loan Eligibility: What Lenders Evaluate',
    excerpt:
      'Understand age, income, credit profile, and property factors that shape home loan eligibility in India.',
    publishedAt: '2026-01-18',
    sections: [
      {
        heading: 'Core eligibility factors',
        paragraphs: [
          'Lenders review age, income stability, existing EMIs, credit score, and property valuation.',
          'Co-applicant income can improve eligibility for many home loan structures.',
        ],
      },
      {
        heading: 'How to prepare',
        paragraphs: [
          'Reduce unsecured debt before applying, maintain clean bank statement behavior, and gather property documents early.',
          'Model EMIs across multiple tenures to choose a sustainable repayment plan.',
        ],
      },
    ],
    relatedSlugs: ['emi-calculation-guide', 'documents-required-personal-loan'],
  },
  {
    slug: 'business-loan-eligibility',
    title: 'Business Loan Eligibility for SMEs and Professionals',
    excerpt:
      'Key criteria lenders review when assessing business loan applications in India.',
    publishedAt: '2026-01-20',
    sections: [
      {
        heading: 'What lenders assess',
        paragraphs: [
          'Business vintage, revenue trends, banking behavior, and compliance records influence approval.',
          'Clear loan purpose and repayment source improve lender confidence.',
        ],
      },
      {
        heading: 'Documentation best practices',
        paragraphs: [
          'Maintain updated GST filings, organized bank statements, and tax records to speed verification.',
          'Borrow based on measurable business outcomes rather than speculative expansion.',
        ],
      },
    ],
    relatedSlugs: ['loan-rejection-reasons', 'documents-required-personal-loan'],
  },
  {
    slug: 'loan-rejection-reasons',
    title: 'Common Loan Rejection Reasons and How to Avoid Them',
    excerpt:
      'Top reasons loan applications are declined and actionable steps to improve approval odds.',
    publishedAt: '2026-01-22',
    sections: [
      {
        heading: 'Frequent rejection causes',
        paragraphs: [
          'Low credit score, high existing debt, unstable income, incomplete documents, and recent delinquencies are common causes.',
          'Applying for an unrealistic loan amount relative to income can also trigger rejection.',
        ],
      },
      {
        heading: 'How to improve approval chances',
        paragraphs: [
          'Correct report errors, reduce utilization, stabilize income documentation, and choose a realistic loan amount.',
          'Work with lenders who provide transparent feedback and responsible borrowing guidance.',
        ],
      },
    ],
    relatedSlugs: ['how-to-improve-cibil-score', 'documents-required-personal-loan'],
  },
  {
    slug: 'personal-loan-interest-rates',
    title: 'Personal Loan Interest Rates: What Borrowers Should Compare',
    excerpt:
      'Look beyond headline rates and evaluate total borrowing cost for personal loans in India.',
    publishedAt: '2026-01-25',
    sections: [
      {
        heading: 'Rate vs total cost',
        paragraphs: [
          'Processing fees, tenure, prepayment penalties, and insurance add-ons affect total loan cost.',
          'A slightly higher rate with lower fees may be cheaper than a low-rate offer with hidden charges.',
        ],
      },
      {
        heading: 'Negotiation and timing',
        paragraphs: [
          'Strong credit profiles and stable salaried income can improve offered rates.',
          'Compare multiple offers and read agreements carefully before acceptance.',
        ],
      },
    ],
    relatedSlugs: ['emi-calculation-guide', 'how-to-improve-cibil-score'],
  },
  {
    slug: 'financial-planning-tips',
    title: 'Financial Planning Tips for Salaried Professionals in India',
    excerpt:
      'Build emergency savings, manage EMIs wisely, and borrow responsibly with simple monthly habits.',
    publishedAt: '2026-01-28',
    sections: [
      {
        heading: 'Build a strong foundation',
        paragraphs: [
          'Maintain an emergency fund covering three to six months of essential expenses before taking new debt.',
          'Track monthly cash flow and separate needs from wants when considering loans.',
        ],
      },
      {
        heading: 'Borrow responsibly',
        paragraphs: [
          'Use loans for value-creating or essential needs, not lifestyle inflation beyond income capacity.',
          'Set calendar reminders for EMIs and review finances quarterly to stay on track.',
        ],
      },
    ],
    relatedSlugs: ['emi-calculation-guide', 'loan-rejection-reasons'],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
