/** Indian mobile: 10 digits, first digit 6–9 (TRAI allocation). */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_REGEX = /^\d{6}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_REGEX = /^\d{12}$/;
export const GSTIN_REGEX = /^[A-Z0-9]{15}$/;
/** MICR cheque leaf number (India): 6 digits. */
export const CHEQUE_NO_REGEX = /^\d{6}$/;

/** TransUnion CIBIL consumer score range (India). */
export const CIBIL_SCORE_MIN = 300;
export const CIBIL_SCORE_MAX = 900;

export function normalizeCibilScore(value: string): string {
  return digitsOnly(value, 3);
}

export function validateCibilScore(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'CIBIL score' } = options;
  const normalized = normalizeCibilScore(value);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  const score = Number(normalized);
  if (!Number.isInteger(score) || score < CIBIL_SCORE_MIN || score > CIBIL_SCORE_MAX) {
    return `${label} must be between ${CIBIL_SCORE_MIN} and ${CIBIL_SCORE_MAX} (Indian CIBIL standard).`;
  }
  return null;
}

export function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '');
  return maxLength != null ? digits.slice(0, maxLength) : digits;
}

/** Strip minus signs and non-numeric characters; keeps at most one decimal point. */
export function normalizeNonNegativeDecimalInput(value: string, maxDecimals = 2): string {
  const withoutMinus = value.replace(/-/g, '');
  let cleaned = withoutMinus.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const integerPart = cleaned.slice(0, dotIndex);
    const decimalPart = cleaned.slice(dotIndex + 1).replace(/\./g, '');
    cleaned = `${integerPart}.${decimalPart.slice(0, maxDecimals)}`;
  }
  return cleaned;
}

export function validateNonNegativeAmount(
  value: string,
  options: { required?: boolean; allowZero?: boolean; label?: string } = {},
): string | null {
  const { required = false, allowZero = true, label = 'Amount' } = options;
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? `${label} is required.` : null;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return `${label} must be a valid number.`;
  }
  if (numeric < 0 || (!allowZero && numeric === 0)) {
    return allowZero
      ? `${label} cannot be negative.`
      : `${label} must be greater than zero.`;
  }
  return null;
}

export function upperAlphanumeric(value: string, maxLength?: number): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return maxLength != null ? cleaned.slice(0, maxLength) : cleaned;
}

export function normalizeIndianMobile(value: string): string {
  let digits = digitsOnly(value);
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

export function validateMobile(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'Mobile number' } = options;
  const normalized = normalizeIndianMobile(value);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!MOBILE_REGEX.test(normalized)) {
    return `${label} must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.`;
  }
  return null;
}

export function validateIfsc(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'IFSC code' } = options;
  const normalized = upperAlphanumeric(value, 11);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!IFSC_REGEX.test(normalized)) {
    return `${label} must be 11 characters: 4 bank letters, 0, then 6 alphanumeric (e.g. SBIN0001234).`;
  }
  return null;
}

export function validatePincode(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'PIN code' } = options;
  const normalized = digitsOnly(value, 6);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!PINCODE_REGEX.test(normalized)) {
    return `${label} must be exactly 6 digits.`;
  }
  return null;
}

export function validatePan(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'PAN number' } = options;
  const normalized = upperAlphanumeric(value, 10);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!PAN_REGEX.test(normalized)) {
    return `${label} must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).`;
  }
  return null;
}

export function validateAadhaar(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'Aadhaar number' } = options;
  const normalized = digitsOnly(value, 12);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!AADHAAR_REGEX.test(normalized)) {
    return `${label} must be exactly 12 digits.`;
  }
  return null;
}

export function validateGstin(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'GSTIN' } = options;
  const normalized = upperAlphanumeric(value, 15);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!GSTIN_REGEX.test(normalized)) {
    return `${label} must be exactly 15 alphanumeric characters.`;
  }
  return null;
}

export function normalizeChequeNo(value: string): string {
  return digitsOnly(value, 6);
}

export function validateChequeNo(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = 'Cheque number' } = options;
  const normalized = digitsOnly(value);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (normalized.length !== 6) {
    return `${label} must be exactly 6 digits.`;
  }
  return null;
}

function parsePositiveAmount(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

export function validateSanctionLoanAmount(loanAmount: string, monthlyIncome: string): string | null {
  const amount = parsePositiveAmount(loanAmount, 'Loan amount');
  if (amount == null) {
    return 'Loan amount must be a positive number.';
  }
  const income = parsePositiveAmount(monthlyIncome, 'Monthly income');
  if (income == null) {
    return 'Monthly income must be a positive number.';
  }
  if (amount >= income) {
    return 'Loan amount must be less than monthly income.';
  }
  return null;
}

export function validateSanctionMonthlyObligation(
  monthlyObligation: string,
  monthlyIncome: string,
): string | null {
  const trimmed = monthlyObligation.trim();
  if (!trimmed) return null;

  const obligation = Number(trimmed);
  if (!Number.isFinite(obligation) || obligation < 0) {
    return 'Monthly obligation cannot be negative.';
  }

  const income = parsePositiveAmount(monthlyIncome, 'Monthly income');
  if (income == null) {
    return 'Monthly income must be a positive number.';
  }
  if (obligation >= income) {
    return 'Monthly obligation must be less than monthly income.';
  }
  return null;
}

/** Returns the first validation error message, or null if all pass. */
export function firstValidationError(...errors: Array<string | null | undefined>): string | null {
  for (const error of errors) {
    if (error) return error;
  }
  return null;
}
