export const ADDRESS_TYPE_OPTIONS = [
  { value: 'own', label: 'Own' },
  { value: 'rented', label: 'Rented' },
] as const;

export type AddressTypeSlug = (typeof ADDRESS_TYPE_OPTIONS)[number]['value'];
export type AddressTypeLabel = (typeof ADDRESS_TYPE_OPTIONS)[number]['label'];

const LEGACY_ADDRESS_TYPE_LABELS: Record<string, AddressTypeLabel> = {
  residential: 'Own',
  current: 'Own',
  permanent: 'Own',
  office: 'Rented',
  correspondence: 'Rented',
  owned: 'Own',
};

export function mapAddressTypeToApi(label: string): AddressTypeSlug {
  const normalized = label.trim().toLowerCase();
  const match = ADDRESS_TYPE_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalized || option.value === normalized,
  );
  if (match) return match.value;
  return normalized === 'rented' ? 'rented' : 'own';
}

export function mapAddressTypeFromApi(code: string): AddressTypeLabel {
  const normalized = (code || '').trim().toLowerCase();
  const match = ADDRESS_TYPE_OPTIONS.find((option) => option.value === normalized);
  if (match) return match.label;
  return LEGACY_ADDRESS_TYPE_LABELS[normalized] ?? 'Own';
}

/** Normalize API/display values to the canonical own | rented slug used in forms. */
export function normalizeAddressTypeSlug(code: string): AddressTypeSlug {
  const normalized = (code || '').trim().toLowerCase();
  const match = ADDRESS_TYPE_OPTIONS.find(
    (option) => option.value === normalized || option.label.toLowerCase() === normalized,
  );
  if (match) return match.value;
  const legacyLabel = LEGACY_ADDRESS_TYPE_LABELS[normalized];
  if (legacyLabel) return legacyLabel === 'Rented' ? 'rented' : 'own';
  return 'own';
}

export function addressTypeLabel(slug: string): AddressTypeLabel {
  const normalized = normalizeAddressTypeSlug(slug);
  return ADDRESS_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Own';
}

export const ADDRESS_TYPE_LABELS = ADDRESS_TYPE_OPTIONS.map((option) => option.label);
