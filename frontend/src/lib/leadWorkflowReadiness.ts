export interface LeadWorkflowReadiness {
  hasDocuments: boolean;
  hasAddress: boolean;
  hasSanction: boolean;
  hasDisbursal: boolean;
}

export interface TabAccessResult {
  allowed: boolean;
  pendingMessage?: string;
  previousStep?: string;
}

const EMPTY_READINESS: LeadWorkflowReadiness = {
  hasDocuments: false,
  hasAddress: false,
  hasSanction: false,
  hasDisbursal: false,
};

export function emptyWorkflowReadiness(): LeadWorkflowReadiness {
  return { ...EMPTY_READINESS };
}

export function getTabAccess(tab: string, readiness: LeadWorkflowReadiness): TabAccessResult {
  switch (tab) {
    case 'customer':
      return { allowed: true };

    case 'sanction': {
      if (readiness.hasSanction) {
        return { allowed: true };
      }

      if (!readiness.hasDocuments && !readiness.hasAddress) {
        return {
          allowed: false,
          previousStep: 'Customer',
          pendingMessage:
            'Upload at least one document or add address details under the Customer tab before loan sanction or rejection.',
        };
      }
      return { allowed: true };
    }

    case 'penny':
    case 'disbursed': {
      if (!readiness.hasSanction) {
        return {
          allowed: false,
          previousStep: 'Sanction',
          pendingMessage: 'Loan sanction is pending. Complete loan sanction before proceeding.',
        };
      }
      return { allowed: true };
    }

    case 'collection': {
      if (!readiness.hasDisbursal) {
        return {
          allowed: false,
          previousStep: 'Disbursal',
          pendingMessage: 'Loan disbursal is pending. Complete disbursal before recording collection.',
        };
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}
