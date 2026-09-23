/** Lead statuses before the customer workflow — customer-tab actions stay hidden. */
const PRE_CUSTOMER_WORKFLOW_LEAD_STATUSES = new Set(['fresh', 'reloan']);

/** Lead statuses where RM/CM can upload and edit customer details. */
const CUSTOMER_ACTION_LEAD_STATUSES = new Set([
  'interested',
  'documents_received',
]);

/** Application statuses where customer-tab actions are enabled. */
const CUSTOMER_ACTION_APPLICATION_STATUSES = new Set([
  'interested',
  'documents_received',
  'documents_incomplete',
  'documents_verified',
  'approved',
  'rejected',
  'disbursal_sheet_sent',
  'disbursed',
  'cancelled',
  'closed',
]);

export function shouldHideCustomerSectionActions(
  applicationStatus: string | null | undefined,
  leadStatus?: string | null | undefined,
): boolean {
  if (applicationStatus && CUSTOMER_ACTION_APPLICATION_STATUSES.has(applicationStatus)) {
    return false;
  }
  if (leadStatus && CUSTOMER_ACTION_LEAD_STATUSES.has(leadStatus)) {
    return false;
  }
  if (leadStatus && PRE_CUSTOMER_WORKFLOW_LEAD_STATUSES.has(leadStatus)) {
    return true;
  }
  // Unknown / collection lead statuses: keep sections view-only unless explicitly allowed above.
  return true;
}

export function canShowCustomerSectionActions(
  applicationStatus: string | null | undefined,
  leadStatus?: string | null | undefined,
): boolean {
  return !shouldHideCustomerSectionActions(applicationStatus, leadStatus);
}
