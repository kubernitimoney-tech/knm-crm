export interface LeadCustomerTabLockedCopy {
  title: string;
  description: string;
  nextStepLabel: string;
  nextStep: string;
}

const DEFAULT_COPY: LeadCustomerTabLockedCopy = {
  title: 'Customer workflow not started yet',
  description:
    'Document, address, company, reference, e-sign, and KYC sections open automatically once the customer is marked Interested on a call log.',
  nextStepLabel: 'Next step',
  nextStep: 'Log a call and select Interested when the customer confirms readiness.',
};

export function getLeadCustomerTabLockedCopy(_leadStatus?: string | null): LeadCustomerTabLockedCopy {
  return DEFAULT_COPY;
}
