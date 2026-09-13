declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer?.push({ event: eventName, ...params });
  window.gtag?.('event', eventName, params);
}

export function trackLeadConversion(leadId: string) {
  trackEvent('generate_lead', {
    lead_id: leadId,
    form_name: 'marketing_apply',
  });
}
