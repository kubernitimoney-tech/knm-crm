import disposableDomains from '@/data/disposable-email-domains.json';

const DISPOSABLE_EMAIL_DOMAINS = new Set(
  (disposableDomains as string[]).map((domain) => domain.toLowerCase()),
);

export function extractEmailDomain(email: string): string {
  return email.trim().toLowerCase().split('@').pop() ?? '';
}

export function isDisposableEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(normalized)) return true;
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (normalized === blocked || normalized.endsWith(`.${blocked}`)) {
      return true;
    }
  }
  return false;
}

export function validateBusinessEmail(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'Email' } = options;
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return `${label} must be a valid email address.`;
  }
  if (isDisposableEmailDomain(extractEmailDomain(normalized))) {
    return `${label} cannot use a disposable email provider.`;
  }
  return null;
}
