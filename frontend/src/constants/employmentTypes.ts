export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self Employed' },
] as const;

export type EmploymentTypeSlug = (typeof EMPLOYMENT_TYPE_OPTIONS)[number]['value'];
export type EmploymentTypeLabel = (typeof EMPLOYMENT_TYPE_OPTIONS)[number]['label'];

const LEGACY_EMPLOYMENT_TYPE_LABELS: Record<string, EmploymentTypeLabel> = {
  business: 'Self Employed',
  other: 'Salaried',
};

export function mapEmploymentTypeToApi(label: string): EmploymentTypeSlug {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, '_');
  const match = EMPLOYMENT_TYPE_OPTIONS.find(
    (option) =>
      option.label.toLowerCase().replace(/\s+/g, '_') === normalized ||
      option.value === normalized,
  );
  if (match) return match.value;
  if (normalized.includes('self')) return 'self_employed';
  return 'salaried';
}

export function mapEmploymentTypeFromApi(code: string): EmploymentTypeLabel {
  const normalized = (code || '').trim().toLowerCase();
  const match = EMPLOYMENT_TYPE_OPTIONS.find((option) => option.value === normalized);
  if (match) return match.label;
  return LEGACY_EMPLOYMENT_TYPE_LABELS[normalized] ?? 'Salaried';
}

export const EMPLOYMENT_TYPE_LABELS = EMPLOYMENT_TYPE_OPTIONS.map((option) => option.label);
