export interface CustomerLeadStatCounts {
  applied: number;
  disbursed: number;
  rejected: number;
  inProcess: number;
  others: number;
}

export interface CustomerLeadStatsInput {
  applied?: number;
  disbursed?: number;
  rejected?: number;
  others?: number;
}

export interface CustomerLeadStatsLeadRow {
  status: string;
  application_status?: string | null;
}

const DISBURSED_APPLICATION_STATUSES = new Set(['disbursed', 'disbursal_sheet_sent']);
const REJECTED_APPLICATION_STATUSES = new Set(['rejected', 'cancelled']);

/** Lead statuses grouped under the Others badge (duplicate, closed, post-loan, etc.). */
export const OTHERS_LEAD_STATUSES = new Set([
  'duplicate_lead',
  'loan_running',
  'part_payment',
  'payday_pre_close',
  'closed',
  'settlement',
]);

function isDisbursedOrRejectedLead(lead: CustomerLeadStatsLeadRow): boolean {
  const appStatus = lead.application_status;
  if (appStatus && DISBURSED_APPLICATION_STATUSES.has(appStatus)) return true;
  if (appStatus && REJECTED_APPLICATION_STATUSES.has(appStatus)) return true;
  return lead.status === 'not_interested';
}

/** Others bucket — excludes leads already counted as disbursed or rejected. */
export function countOthersLeads(leads: CustomerLeadStatsLeadRow[] | undefined): number {
  if (!leads?.length) return 0;
  return leads.filter(
    (lead) =>
      OTHERS_LEAD_STATUSES.has(lead.status) && !isDisbursedOrRejectedLead(lead),
  ).length;
}

/** KPI counts: in-process excludes disbursed, rejected, and others bucket. */
export function computeCustomerLeadStatCounts(
  stats: CustomerLeadStatsInput,
  leads: { status: string }[] | undefined,
): CustomerLeadStatCounts {
  const applied = stats.applied ?? 0;
  const disbursed = stats.disbursed ?? 0;
  const rejected = stats.rejected ?? 0;
  const others =
    stats.others !== undefined
      ? stats.others
      : leads?.length
        ? countOthersLeads(leads)
        : 0;
  const inProcess = Math.max(applied - disbursed - rejected - others, 0);

  return { applied, disbursed, rejected, inProcess, others };
}
