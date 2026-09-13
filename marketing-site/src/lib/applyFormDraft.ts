import type { DefaultValues } from 'react-hook-form';
import { defaultFormValues, type ApplyFormValues } from '@/lib/applyFormSchema';

const DRAFT_KEY = 'km_apply_form_draft_v4';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadApplyFormDraft(): DefaultValues<ApplyFormValues> {
  if (typeof window === 'undefined') return defaultFormValues;

  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultFormValues;

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return defaultFormValues;

    return {
      ...defaultFormValues,
      ...Object.fromEntries(
        Object.keys(defaultFormValues).map((key) => {
          const typedKey = key as keyof ApplyFormValues;
          const incoming = parsed[typedKey];
          const fallback = defaultFormValues[typedKey];

          if (typeof fallback === 'boolean') {
            return [typedKey, typeof incoming === 'boolean' ? incoming : fallback];
          }

          if (typedKey === 'employment_type') {
            return [
              typedKey,
              incoming === 'salaried' || incoming === 'self_employed' ? incoming : undefined,
            ];
          }

          return [typedKey, typeof incoming === 'string' ? incoming : fallback];
        }),
      ),
    };
  } catch {
    return defaultFormValues;
  }
}

export function saveApplyFormDraft(values: ApplyFormValues) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearApplyFormDraft() {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
