import { brand } from '@/lib/brand';

export interface ChatbotReply {
  keywords: string[];
  answer: string;
  action?: 'apply' | 'contact';
}

export const chatbotGreeting =
  "Hi! I'm the Kuberniti Money assistant. How can I help?";

export const chatbotQuickReplies = [
  { label: 'Eligibility', key: 'eligibility' },
  { label: 'Documents', key: 'documents' },
  { label: 'Apply', key: 'apply' },
  { label: 'Contact', key: 'contact' },
] as const;

export const chatbotReplies: Record<string, ChatbotReply> = {
  eligibility: {
    keywords: ['eligibility', 'eligible', 'who can', 'qualify', 'age', 'salaried'],
    answer:
      'To apply, you should be an Indian resident, 21+ years old, and a salaried professional with stable monthly income (minimum ₹40,000/month if disclosed). Ready to check your eligibility? Tap Apply below.',
    action: 'apply',
  },
  documents: {
    keywords: ['document', 'documents', 'pan', 'aadhaar', 'proof', 'papers'],
    answer:
      'You will typically need PAN, Aadhaar, and salary proof (payslips or bank statements). Our team will confirm the exact list during verification.',
  },
  apply: {
    keywords: ['apply', 'application', 'loan', 'how to apply', 'start'],
    answer: 'Great! You can apply in minutes from your phone. Tap below to start your application.',
    action: 'apply',
  },
  contact: {
    keywords: ['contact', 'support', 'phone', 'email', 'call', 'help', 'reach'],
    answer: `Reach us at ${brand.supportEmail} or call ${brand.supportPhone} (Mon–Sat, 9 AM – 6 PM IST). You can also visit our Contact page for more details.`,
    action: 'contact',
  },
  approval: {
    keywords: ['approval', 'how long', 'time', 'disbursal', 'when'],
    answer:
      'Most applications are reviewed within a few hours on business days. After approval and document verification, funds are typically disbursed within 24–48 hours.',
  },
  repayment: {
    keywords: ['repay', 'repayment', 'emi', 'due', 'pay back'],
    answer:
      'Repayment is aligned with your salary cycle. We provide clear schedules with no hidden surprises. Contact support if you need to discuss your repayment plan.',
  },
  default: {
    keywords: [],
    answer:
      "I can help with eligibility, documents, applying, or contacting support. Try one of the quick replies below, or visit our FAQ page for more details.",
  },
};

export function findChatbotReply(input: string): ChatbotReply {
  const normalized = input.toLowerCase().trim();

  for (const [, reply] of Object.entries(chatbotReplies)) {
    if (reply.keywords.some((kw) => normalized.includes(kw))) {
      return reply;
    }
  }

  return chatbotReplies.default;
}
