import {
  createLoanFromApplication,
  fetchApplication,
  fetchApplications,
  fetchLoanForApplication,
  fetchProducts,
  submitApplication,
  type ApiLoanApplication,
} from '@/lib/applicationsApi';
import { type ApiLoan } from '@/lib/loansApi';
import { convertLead, fetchLead, type ApiLead } from '@/lib/leadsApi';

export async function getLeadApplication(
  leadId: string,
  lead?: ApiLead | null,
): Promise<ApiLoanApplication | null> {
  const resolvedLead = lead ?? (await fetchLead(leadId));
  if (resolvedLead.converted_application) {
    return fetchApplication(resolvedLead.converted_application);
  }
  const apps = await fetchApplications({ lead: leadId, page_size: 1 });
  return apps.results[0] ?? null;
}

export async function ensureLeadApplication(
  leadId: string,
  options?: { requestedAmount?: string | number | null; productId?: string | null },
): Promise<{ lead: ApiLead; application: ApiLoanApplication }> {
  const lead = await fetchLead(leadId);
  const existing = await getLeadApplication(leadId, lead);
  if (existing) {
    return { lead, application: existing };
  }

  const products = await fetchProducts();
  let product = options?.productId
    ? products.find((item) => item.id === options.productId)
    : undefined;
  if (!product) {
    product =
      products.find((item) => item.product_code === 'PAYDAY') ??
      products.find((item) => item.product_code === 'PD') ??
      products[0];
  }
  if (!product) {
    throw new Error('No active loan product is configured.');
  }

  const requestedAmount =
    options?.requestedAmount ??
    lead.required_amount ??
    undefined;

  const converted = await convertLead(leadId, {
    product_id: product.id,
    ...(requestedAmount != null && requestedAmount !== ''
      ? { requested_amount: Number(requestedAmount) }
      : {}),
  });
  return { lead: converted.lead, application: converted.application };
}

const SUBMITTABLE_APPLICATION_STATUSES = new Set(['interested', 'documents_received']);

export async function submitApplicationIfNeeded(
  application: ApiLoanApplication,
): Promise<ApiLoanApplication> {
  if (SUBMITTABLE_APPLICATION_STATUSES.has(application.status)) {
    return submitApplication(application.id);
  }
  return application;
}

export async function getLoanForApplication(applicationId: string): Promise<ApiLoan | null> {
  const loan = await fetchLoanForApplication(applicationId);
  return loan as ApiLoan | null;
}

export async function ensureLoan(
  applicationId: string,
  options?: { skipLookup?: boolean },
): Promise<ApiLoan> {
  if (!options?.skipLookup) {
    const existing = await getLoanForApplication(applicationId);
    if (existing) return existing;
  }
  const created = await createLoanFromApplication(applicationId);
  return created as unknown as ApiLoan;
}
