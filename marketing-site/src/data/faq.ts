export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const faqItems: FaqItem[] = [
  {
    id: 'eligibility',
    category: 'Eligibility',
    question: 'Who is eligible for a Kuberniti Money loan?',
    answer:
      'You must be an Indian resident, at least 21 years old, and a salaried professional with a stable monthly income. We serve working professionals who need short-term funds between paydays.',
  },
  {
    id: 'documents',
    category: 'Documents',
    question: 'What documents do I need to apply?',
    answer:
      'Typically you will need your PAN card, Aadhaar card, and recent salary proof (such as payslips or bank statements). Our team will guide you through the exact documents during verification.',
  },
  {
    id: 'approval-time',
    category: 'Process',
    question: 'How long does approval take?',
    answer:
      'Most applications are reviewed quickly on business days. Once approved and documents are verified, disbursal is typically completed within a few minutes, subject to bank processing and eligibility.',
  },
  {
    id: 'repayment',
    category: 'Repayment',
    question: 'How is repayment done?',
    answer:
      'Repayment is aligned with your salary cycle. We offer clear schedules with transparent terms so you know exactly when and how much to repay. Options include auto-debit and online payment methods.',
  },
  {
    id: 'data-safety',
    category: 'Privacy',
    question: 'Is my personal data safe?',
    answer:
      'Yes. We use industry-standard encryption and follow data protection best practices. Your information is used only for loan processing and is never shared with unauthorized third parties.',
  },
  {
    id: 'missed-repayment',
    category: 'Repayment',
    question: 'What if I miss a repayment?',
    answer:
      'We encourage responsible borrowing. If you anticipate difficulty, contact our support team early — we work with customers to find workable solutions. Late payments may attract fees as per your loan agreement.',
  },
  {
    id: 'loan-amount',
    category: 'Eligibility',
    question: 'How much can I borrow?',
    answer:
      'Loan amounts depend on your monthly income and eligibility assessment. Generally, the requested amount should be less than your monthly salary. Our team will help you find an amount that fits your profile.',
  },
  {
    id: 'fees',
    category: 'Fees',
    question: 'Are there any hidden fees?',
    answer:
      'No hidden surprises. All applicable fees, interest rates, and charges are disclosed upfront before you accept the loan. We believe in transparent, compliance-friendly lending.',
  },
];
