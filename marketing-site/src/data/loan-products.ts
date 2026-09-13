export interface LoanProductSection {
  heading: string;
  paragraphs: string[];
}

export interface LoanProductConfig {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  sections: LoanProductSection[];
  highlights: string[];
  relatedSlugs: string[];
  faqs: { question: string; answer: string }[];
  city?: string;
}

function buildSections(paragraphs: string[], headingPrefix: string): LoanProductSection[] {
  const chunkSize = 2;
  const sections: LoanProductSection[] = [];
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    sections.push({
      heading: `${headingPrefix} ${Math.floor(i / chunkSize) + 1}`,
      paragraphs: paragraphs.slice(i, i + chunkSize),
    });
  }
  return sections;
}

const personalLoanParagraphs = [
  'A personal loan helps salaried professionals manage planned and unplanned expenses without disrupting monthly cash flow. Whether you need funds for a medical emergency, wedding, travel, bill payment, or a short-term purchase, a structured personal loan gives you clarity on repayment before you commit.',
  'At Kuberniti Money, personal loans are designed for working Indians who value speed, transparency, and human support. Our process focuses on responsible lending — we assess income, employment stability, and repayment capacity before recommending an amount that fits your profile.',
  'Applicants typically need to be Indian residents, at least 21 years old, and salaried with a stable monthly income. Documents commonly include PAN, Aadhaar, and recent salary proof. Our team guides you through verification and keeps communication clear at every step.',
  'Interest rates, processing fees, and tenure are disclosed upfront. You can choose a repayment schedule aligned with your salary cycle, making it easier to plan EMIs without surprises. We do not believe in hidden charges or misleading promises.',
  'Many customers use personal loans to bridge short gaps between paydays, cover immediate commitments, or consolidate smaller expenses into one predictable EMI. The key is borrowing only what you need and ensuring timely repayment to maintain a healthy credit profile.',
  'If you are comparing lenders, look beyond advertised rates. Evaluate approval timelines, document requirements, customer support quality, and clarity of loan agreements. A trustworthy lender explains every fee and helps you understand the total cost of borrowing.',
  'Kuberniti Money supports customers across major Indian cities with digital-first applications and responsive assistance. You can apply online in minutes and receive a callback from our team to complete verification and move toward disbursal.',
  'Before applying, prepare your KYC documents, confirm your monthly income, and decide the loan amount you genuinely need. Responsible borrowing protects your financial health and improves your chances of smooth approval and stress-free repayment.',
];

export const loanProducts: LoanProductConfig[] = [
  {
    slug: 'personal-loan',
    name: 'Personal Loan',
    headline: 'Personal loans for salaried Indians',
    intro:
      'Quick, transparent personal loans for medical needs, weddings, travel, emergencies, and short-term commitments.',
    sections: buildSections(personalLoanParagraphs, 'Why choose personal loans'),
    highlights: ['Fast online application', 'Clear repayment schedule', 'No hidden fees', 'Dedicated support'],
    relatedSlugs: ['business-loan', 'emi-calculator', 'cibil-score'],
    faqs: [
      {
        question: 'Who can apply for a personal loan?',
        answer:
          'Salaried Indian residents aged 21+ with stable income and valid KYC documents can apply.',
      },
      {
        question: 'How fast is disbursal?',
        answer:
          'After approval and document verification, disbursal is typically completed within a few minutes, subject to bank processing.',
      },
    ],
  },
  {
    slug: 'business-loan',
    name: 'Business Loan',
    headline: 'Business loans for growth and working capital',
    intro:
      'Finance inventory, operations, expansion, or short-term business needs with transparent terms.',
    sections: buildSections([
      'Business loans help entrepreneurs and small business owners manage cash flow, purchase inventory, upgrade equipment, or fund expansion plans. Unlike ad-hoc borrowing, a structured business loan provides predictable repayment and documented terms.',
      'Kuberniti Money supports professionals and SMEs looking for practical funding with clear communication. We review business stability, cash flows, and repayment capacity before recommending suitable loan structures.',
      'Documentation may include business proof, bank statements, KYC, and income evidence depending on your profile. Our team explains requirements upfront so you can prepare and avoid delays.',
      'Transparent pricing matters for business borrowers because margins are sensitive. We disclose applicable interest, fees, and repayment schedules before you accept an offer.',
      'Business loans can be used for working capital, vendor payments, marketing campaigns, or bridging seasonal revenue gaps. Borrow strategically and align EMIs with expected cash inflows.',
      'Compare lenders on speed, support, and clarity — not just rate headlines. A reliable partner helps you understand total cost and repayment impact on your operations.',
      'Digital application reduces paperwork friction and helps you start the process quickly. Our specialists follow up to complete verification and guide next steps.',
      'Plan your loan amount based on actual business need, maintain clean financial records, and keep repayments on schedule to build stronger credit for future funding.',
    ], 'Business loan insights'),
    highlights: ['SME-friendly process', 'Working capital support', 'Transparent fees', 'Guided documentation'],
    relatedSlugs: ['msme-loan', 'personal-loan', 'emi-calculator'],
    faqs: [
      {
        question: 'Can freelancers apply for a business loan?',
        answer:
          'Eligibility depends on income stability and documentation. Contact our team to review your profile.',
      },
      {
        question: 'What can business loan funds be used for?',
        answer:
          'Common uses include inventory, operations, equipment, and short-term growth initiatives.',
      },
    ],
  },
  {
    slug: 'home-loan',
    name: 'Home Loan',
    headline: 'Home loans for purchase, construction, and renovation',
    intro:
      'Explore home loan options with clear eligibility guidance, document checklists, and EMI planning support.',
    sections: buildSections([
      'A home loan is a long-term commitment that helps you buy, build, or renovate a residential property while spreading cost over manageable EMIs. Because tenure can extend for years, choosing the right lender and understanding total interest outflow is critical.',
      'Kuberniti Money helps applicants understand eligibility basics, documentation, and EMI implications before they apply. We focus on transparent communication so you can plan confidently.',
      'Typical eligibility factors include age, income stability, credit profile, property value, and down-payment capacity. Lenders evaluate your ability to service EMIs alongside existing obligations.',
      'Documents often include identity proof, income proof, property papers, and bank statements. Requirements vary by profile and property type; our team provides a checklist during consultation.',
      'Use our EMI calculator to model monthly payments across different rates and tenures. Small changes in rate or tenure can significantly affect total interest paid over the loan life.',
      'Home loan applicants should compare processing fees, prepayment terms, and customer support quality. A lower rate alone does not always mean better value if fees or flexibility are poor.',
      'Whether you are a first-time buyer or upgrading homes, plan for down payment, registration costs, and emergency reserves beyond EMI obligations.',
      'Start with a realistic budget, improve your credit profile, and gather documents early to reduce approval delays and make informed property decisions.',
    ], 'Home loan guidance'),
    highlights: ['Eligibility guidance', 'Document checklist', 'EMI planning', 'Transparent advice'],
    relatedSlugs: ['loan-against-property', 'emi-calculator', 'cibil-score'],
    faqs: [
      {
        question: 'What is the minimum down payment?',
        answer:
          'Down payment requirements vary by lender and property profile. Our team will guide you during assessment.',
      },
      {
        question: 'Can I prepay a home loan?',
        answer:
          'Prepayment terms depend on your loan agreement. Review applicable charges and benefits before prepaying.',
      },
    ],
  },
  {
    slug: 'education-loan',
    name: 'Education Loan',
    headline: 'Education loans for tuition and study expenses',
    intro:
      'Fund tuition, accommodation, and study-related costs with structured repayment and clear loan terms.',
    sections: buildSections([
      'Education loans help students and families finance tuition, living expenses, books, and related study costs. For many households, education funding is a major financial decision that requires careful planning.',
      'Kuberniti Money provides guidance on eligibility, documentation, and repayment expectations for education-related borrowing. Transparency helps families avoid surprises during the study period.',
      'Lenders typically review admission proof, course details, co-applicant income, and credit history. Strong documentation improves approval speed and helps secure suitable terms.',
      'Education loans may cover tuition fees, hostel costs, travel, and equipment depending on the program and lender policy. Confirm coverage details before accepting an offer.',
      'Repayment often begins after course completion or moratorium periods. Model future EMIs early so graduates can plan careers and finances realistically.',
      'Compare lenders on interest rate, processing fee, moratorium flexibility, and support during the study cycle. Good guidance matters as much as rate for student borrowers.',
      'Students should maintain academic progress, keep documents updated, and communicate early if repayment challenges are expected after graduation.',
      'Apply with a clear study plan, realistic budget, and co-applicant financial profile to improve approval confidence and long-term repayment success.',
    ], 'Education loan essentials'),
    highlights: ['Tuition funding', 'Study expense support', 'Clear moratorium guidance', 'Family-friendly process'],
    relatedSlugs: ['personal-loan', 'emi-calculator', 'blog'],
    faqs: [
      {
        question: 'Do education loans cover living expenses?',
        answer:
          'Coverage depends on loan structure and institution. Discuss eligible expenses with our support team.',
      },
      {
        question: 'Is a co-applicant required?',
        answer:
          'Many education loans require a co-applicant with stable income. Requirements vary by profile.',
      },
    ],
  },
  {
    slug: 'gold-loan',
    name: 'Gold Loan',
    headline: 'Gold loans with quick access to funds',
    intro:
      'Unlock liquidity against gold assets with competitive rates, secure handling, and flexible tenure options.',
    sections: buildSections([
      'Gold loans allow borrowers to access funds quickly by pledging gold jewelry or ornaments as collateral. They are often chosen for short-term needs because processing can be faster than unsecured products.',
      'Kuberniti Money explains valuation methods, applicable rates, tenure options, and repayment expectations before you proceed. Clear terms help you decide if a gold loan fits your need.',
      'Loan amount depends on gold purity, weight, and current valuation policies. Borrowers should understand how market fluctuations and tenure affect total repayment.',
      'Keep KYC documents ready and verify chain-of-custody and security practices used during pledge and release. Trust and transparency are essential in collateral-based lending.',
      'Gold loans are commonly used for medical emergencies, business cash gaps, or short-term obligations. Avoid over-borrowing against sentimental assets without a repayment plan.',
      'Compare lenders on interest rate, processing fee, auction/penalty clauses, and release timelines. Read agreement terms carefully before pledging ornaments.',
      'Timely repayment helps you reclaim pledged gold without stress. If you anticipate delays, contact support early to discuss options.',
      'Evaluate whether a gold loan is the most cost-effective option versus personal or business loans for your specific situation before applying.',
    ], 'Gold loan details'),
    highlights: ['Quick processing', 'Secure pledge handling', 'Flexible tenure', 'Transparent valuation'],
    relatedSlugs: ['personal-loan', 'business-loan', 'faq'],
    faqs: [
      {
        question: 'What gold items are accepted?',
        answer:
          'Accepted items and purity standards depend on policy. Our team will confirm during application.',
      },
      {
        question: 'How is gold valued?',
        answer:
          'Valuation is based on weight, purity, and prevailing market benchmarks per lender policy.',
      },
    ],
  },
  {
    slug: 'loan-against-property',
    name: 'Loan Against Property',
    headline: 'Raise funds against residential or commercial property',
    intro:
      'Leverage property value for business growth, education, or major expenses with structured long-term repayment.',
    sections: buildSections([
      'Loan against property (LAP) allows owners to borrow against residential or commercial real estate while continuing to use the asset. It is commonly used for higher ticket funding needs.',
      'Because LAP involves property collateral, lenders evaluate title clarity, valuation, income profile, and existing liabilities in detail. Documentation can be more extensive than unsecured loans.',
      'Kuberniti Money helps applicants understand eligibility, LTV limits, rate impact, and tenure choices before they commit. Transparent guidance reduces costly mistakes.',
      'Funds may be used for business expansion, education, medical needs, or debt consolidation depending on lender policy. Confirm permitted end-use during assessment.',
      'Longer tenures reduce EMI but increase total interest paid. Use EMI calculators and stress-test repayments under different income scenarios.',
      'Property owners should verify legal title, insurance status, and encumbrance details before applying. Clean documentation speeds approval.',
      'Compare prepayment terms, processing charges, and customer support responsiveness across lenders — not just headline rates.',
      'Borrow only what you need, maintain repayment discipline, and protect property-related documents throughout the loan lifecycle.',
    ], 'Loan against property guide'),
    highlights: ['Higher loan amounts', 'Property-backed funding', 'Structured tenure', 'Expert guidance'],
    relatedSlugs: ['home-loan', 'business-loan', 'emi-calculator'],
    faqs: [
      {
        question: 'Can I continue using my property during the loan?',
        answer:
          'In most LAP structures, you retain usage rights while the lender holds lien per agreement terms.',
      },
      {
        question: 'What LTV can I expect?',
        answer:
          'Loan-to-value depends on property type, location, and profile. Our team provides estimates during review.',
      },
    ],
  },
  {
    slug: 'msme-loan',
    name: 'MSME Loan',
    headline: 'MSME loans for small and medium enterprises',
    intro:
      'Working capital and growth funding tailored for Indian MSMEs with practical documentation support.',
    sections: buildSections([
      'MSME loans support small and medium enterprises with funding for inventory, payroll, machinery, and expansion. Access to timely credit helps businesses stabilize operations and capture growth opportunities.',
      'Kuberniti Money works with business owners who need clear terms and responsive support rather than complex, opaque lending experiences.',
      'Eligibility often depends on business vintage, turnover trends, bank statement behavior, and compliance documentation. Strong records improve approval outcomes.',
      'MSME borrowers should align loan purpose with measurable business outcomes — such as higher throughput, reduced stockouts, or expanded distribution.',
      'Transparent fee disclosure and predictable EMIs help owners manage cash flow while servicing debt responsibly.',
      'Digital application reduces initial friction, while specialist follow-up ensures documentation completeness and faster decisioning.',
      'Maintain GST, banking, and tax records cleanly to speed verification. Lenders trust businesses with consistent financial discipline.',
      'If your funding need is seasonal, discuss tenure and repayment structuring upfront to avoid cash flow stress during low-revenue months.',
    ], 'MSME loan support'),
    highlights: ['MSME-focused', 'Working capital', 'Growth funding', 'Practical documentation help'],
    relatedSlugs: ['business-loan', 'personal-loan', 'contact'],
    faqs: [
      {
        question: 'Are startups eligible for MSME loans?',
        answer:
          'Eligibility depends on business maturity and financial records. Speak with our team to review options.',
      },
      {
        question: 'What documents are commonly required?',
        answer:
          'Typical documents include KYC, business proof, bank statements, and income or turnover evidence.',
      },
    ],
  },
  {
    slug: 'vehicle-loan',
    name: 'Vehicle Loan',
    headline: 'Vehicle loans for cars and two-wheelers',
    intro:
      'Finance your next vehicle with competitive rates, clear EMI schedules, and guided documentation.',
    sections: buildSections([
      'Vehicle loans help buyers spread the cost of cars, two-wheelers, or commercial vehicles over manageable EMIs. Choosing the right tenure and down payment is key to affordable ownership.',
      'Kuberniti Money guides applicants through eligibility, required documents, insurance considerations, and EMI planning before purchase decisions.',
      'Lenders evaluate income stability, credit profile, vehicle type, and down-payment contribution. Preparing documents early reduces delays at dealership or delivery stages.',
      'Compare on-road cost, interest rate, processing fee, and prepayment flexibility — not just monthly EMI alone. Total cost of ownership includes insurance, maintenance, and fuel.',
      'Shorter tenures reduce interest outflow but increase EMI. Longer tenures improve affordability but raise total interest. Model both scenarios before signing.',
      'Used vehicle loans may have different LTV and rate policies than new vehicle loans. Confirm terms specific to your purchase type.',
      'Maintain timely EMI payments to protect your credit profile and avoid repossession risk under loan agreements.',
      'Apply once you have shortlisted a vehicle, confirmed budget, and gathered KYC and income documents for smooth processing.',
    ], 'Vehicle loan planning'),
    highlights: ['Car and two-wheeler finance', 'EMI clarity', 'Fast application', 'Purchase guidance'],
    relatedSlugs: ['personal-loan', 'emi-calculator', 'cibil-score'],
    faqs: [
      {
        question: 'Can I finance a used vehicle?',
        answer:
          'Used vehicle financing may be available depending on vehicle age, condition, and lender policy.',
      },
      {
        question: 'Is insurance mandatory?',
        answer:
          'Lenders typically require valid vehicle insurance as part of financing arrangements.',
      },
    ],
  },
];

const cityNames = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad'] as const;

export const cityPersonalLoans: LoanProductConfig[] = cityNames.map((city) => ({
  slug: `personal-loan-${city.toLowerCase()}`,
  name: `Personal Loan in ${city}`,
  headline: `Personal loans for salaried professionals in ${city}`,
  intro: `Apply for a personal loan in ${city} with transparent terms, quick review, and dedicated support for salaried Indians.`,
  sections: buildSections([
    `${city} residents face rising living costs, commute expenses, and occasional emergencies that do not align with monthly salary cycles. A personal loan can provide structured access to funds when used responsibly.`,
    `Kuberniti Money supports salaried applicants in ${city} with a digital-first process, clear documentation guidance, and human assistance during verification.`,
    `Eligibility typically requires Indian residency, age 21+, stable salaried income, and valid KYC. Keep PAN, Aadhaar, and salary proof ready to speed up review.`,
    `Before applying, estimate the exact amount you need and use our EMI calculator to understand monthly repayment impact on your ${city} household budget.`,
    `Compare lenders on transparency, support quality, and total borrowing cost — not just advertised rates. Hidden fees can make a seemingly cheap loan expensive.`,
    `Our team explains interest, tenure, and repayment schedule before you accept an offer. We encourage responsible borrowing and timely EMI payments.`,
    `Personal loans in ${city} are commonly used for medical bills, rent deposits, appliance purchases, travel, and short-term family commitments.`,
    `Apply online today and our specialists will contact you to complete verification and discuss next steps toward approval and disbursal.`,
  ], `${city} personal loan insights`),
  highlights: [`${city}-focused support`, 'Fast application', 'Clear repayment', 'Trusted process'],
  relatedSlugs: ['personal-loan', 'emi-calculator', 'faq'],
  faqs: [
    {
      question: `Can salaried employees in ${city} apply online?`,
      answer: 'Yes. Complete the online form and our team will guide you through verification.',
    },
    {
      question: 'What documents are required?',
      answer: 'PAN, Aadhaar, and recent salary proof are commonly required for salaried applicants.',
    },
  ],
  city,
}));

export function getLoanProductBySlug(slug: string): LoanProductConfig | undefined {
  return [...loanProducts, ...cityPersonalLoans].find((product) => product.slug === slug);
}

export const allLoanSlugs = [...loanProducts, ...cityPersonalLoans].map((p) => p.slug);
