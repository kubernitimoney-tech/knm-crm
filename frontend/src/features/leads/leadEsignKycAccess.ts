/** Hide Log Call only after Interested or Documents Received. */
export const CALL_LOG_BLOCKED_LEAD_STATUSES = new Set([
  'interested',
  'documents_received',
]);

type LeadCallAccess = {
  status: string;
  close_reason?: string | null;
};

/** True when the lead was closed due to DND (legacy close reason). */
export function isDndLead(lead: LeadCallAccess | null | undefined): boolean {
  return lead?.status === 'closed' && lead.close_reason === 'dnd';
}

export function canLogCallOnLeadTimeline(
  lead: LeadCallAccess | null | undefined,
  hasPermission: boolean,
): boolean {
  if (!hasPermission || !lead) return false;
  if (CALL_LOG_BLOCKED_LEAD_STATUSES.has(lead.status)) return false;
  if (isDndLead(lead)) return false;
  return true;
}

/** Application statuses when e-sign and video KYC requests are available. */
export const ESIGN_VIDEO_KYC_APPLICATION_STATUSES = new Set([
  'approved',
  'disbursal_sheet_sent',
  'disbursed',
]);

export function canRequestEsignAndVideoKyc(applicationStatus: string | null | undefined): boolean {
  if (!applicationStatus) return false;
  return ESIGN_VIDEO_KYC_APPLICATION_STATUSES.has(applicationStatus);
}
