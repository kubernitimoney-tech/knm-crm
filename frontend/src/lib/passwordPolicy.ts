/** Mirrors the backend AUTH_PASSWORD_VALIDATORS so users see problems before submitting. */
export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A digit', test: (v) => /\d/.test(v) },
  { label: 'A symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** First unmet rule as a sentence, or null when the password meets every rule. */
export function validatePasswordPolicy(value: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}
