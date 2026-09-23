import {
  isStatusWiseLeadTab,
  type StatusWiseLeadTab,
} from '@/features/leads/statusWiseLeadTabs';

/** Where to return when leaving lead details (Back button). */
export type LeadListReturnTo =
  | { type: 'all-leads' }
  | { type: 'status-wise'; tab: StatusWiseLeadTab };

export const ALL_LEADS_PATH = '/leads/all';
export const STATUS_WISE_LEADS_PATH = '/leads/status';

export function statusWiseLeadsPath(tab: StatusWiseLeadTab): string {
  return `${STATUS_WISE_LEADS_PATH}?tab=${encodeURIComponent(tab)}`;
}

/** Lead details route; optional `from` query preserves list back-navigation. */
export function leadDetailsPath(leadId: string, returnTo?: LeadListReturnTo): string {
  const base = `/leads/all/${leadId}`;
  if (returnTo?.type === 'status-wise') {
    return `${base}?from=status&tab=${encodeURIComponent(returnTo.tab)}`;
  }
  return `${base}?from=all`;
}

/** In-app document viewer — keeps LMS favicon and auth on the frontend origin. */
export function leadDocumentViewPath(leadId: string, documentId: string): string {
  return `/leads/all/${leadId}/documents/${documentId}/view`;
}

/** In-app signed e-sign PDF viewer. */
export function leadEsignViewPath(leadId: string, requestId: string): string {
  return `/leads/all/${leadId}/esign/${requestId}/view`;
}

/** Read list return context from the current lead-details URL (for related-lead links). */
export function leadListReturnToFromSearchParams(
  params: Pick<URLSearchParams, 'get'>,
): LeadListReturnTo | undefined {
  if (params.get('from') === 'status') {
    const tab = params.get('tab');
    if (isStatusWiseLeadTab(tab)) {
      return { type: 'status-wise', tab };
    }
  }
  if (params.get('from') === 'all') {
    return { type: 'all-leads' };
  }
  return undefined;
}

/** Resolve Back target from lead-details URL search params. */
export function resolveLeadListBackPath(params: Pick<URLSearchParams, 'get'>): string {
  if (params.get('from') === 'status') {
    const tab = params.get('tab');
    if (isStatusWiseLeadTab(tab)) {
      return statusWiseLeadsPath(tab);
    }
    return STATUS_WISE_LEADS_PATH;
  }
  return ALL_LEADS_PATH;
}

/** Customer profile route; optional lead query focuses workflow context. */
export function customerDetailsPath(customerId: string, leadId?: string): string {
  if (!customerId) return '/customers';
  if (leadId) return `/customers/${customerId}?lead=${encodeURIComponent(leadId)}`;
  return `/customers/${customerId}`;
}
