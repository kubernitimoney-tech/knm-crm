export interface LeadWorkflowReadiness {
  hasDocuments: boolean;
  hasAddress: boolean;
  hasSanction: boolean;
  hasEsignCompleted: boolean;
  /** Disbursal sheet exists or the loan is already disbursed. */
  hasDisbursalSheet: boolean;
  /** Loan has been disbursed. */
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
  hasEsignCompleted: false,
  hasDisbursalSheet: false,
  hasDisbursal: false,
};

export function emptyWorkflowReadiness(): LeadWorkflowReadiness {
  return { ...EMPTY_READINESS };
}

export function hasCustomerPrerequisites(readiness: LeadWorkflowReadiness): boolean {
  return readiness.hasDocuments && readiness.hasAddress;
}

function customerPrerequisiteBlock(readiness: LeadWorkflowReadiness): TabAccessResult | null {
  if (hasCustomerPrerequisites(readiness)) {
    return null;
  }
  const missing: string[] = [];
  if (!readiness.hasDocuments) {
    missing.push('upload at least one document');
  }
  if (!readiness.hasAddress) {
    missing.push('add address details');
  }
  return {
    allowed: false,
    previousStep: 'Customer',
    pendingMessage: `Complete the Customer tab first: ${missing.join(' and ')} before continuing.`,
  };
}

export function getTabAccess(tab: string, readiness: LeadWorkflowReadiness): TabAccessResult {
  switch (tab) {
    case 'customer':
      return { allowed: true };

    case 'sanction': {
      if (readiness.hasSanction) {
        return { allowed: true };
      }
      return customerPrerequisiteBlock(readiness) ?? { allowed: true };
    }

    case 'penny': {
      const customerBlock = customerPrerequisiteBlock(readiness);
      if (customerBlock && !readiness.hasSanction) {
        return customerBlock;
      }
      if (!readiness.hasSanction) {
        return {
          allowed: false,
          previousStep: 'Sanction',
          pendingMessage: 'Loan sanction is pending. Complete loan sanction before proceeding.',
        };
      }
      return { allowed: true };
    }

    case 'disbursed': {
      if (readiness.hasDisbursal || readiness.hasDisbursalSheet) {
        return { allowed: true };
      }
      const customerBlock = customerPrerequisiteBlock(readiness);
      if (customerBlock && !readiness.hasSanction) {
        return customerBlock;
      }
      if (!readiness.hasSanction) {
        return {
          allowed: false,
          previousStep: 'Sanction',
          pendingMessage: 'Loan sanction is pending. Complete loan sanction before proceeding.',
        };
      }
      if (!readiness.hasEsignCompleted) {
        return {
          allowed: false,
          previousStep: 'E-sign',
          pendingMessage: 'Customer e-sign is pending. Complete e-sign before disbursal.',
        };
      }
      return { allowed: true };
    }

    case 'collection': {
      const customerBlock = customerPrerequisiteBlock(readiness);
      if (customerBlock && !readiness.hasDisbursal) {
        return customerBlock;
      }
      if (!readiness.hasDisbursal) {
        return {
          allowed: false,
          previousStep: 'Disbursal',
          pendingMessage: 'Loan disbursal is pending. Complete disbursal before recording collection.',
        };
      }
      return { allowed: true };
    }

    case 'recovery':
    case 'communication':
    case 'refund': {
      if (readiness.hasSanction || readiness.hasDisbursal) {
        return { allowed: true };
      }
      return customerPrerequisiteBlock(readiness) ?? { allowed: true };
    }

    default:
      return { allowed: true };
  }
}
