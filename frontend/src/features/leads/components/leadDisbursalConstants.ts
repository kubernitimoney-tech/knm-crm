export const COMPANY_ACCOUNT_OPTIONS = [
  'LMS Corporate Account - HDFC',
  'LMS Corporate Account - ICICI',
  'LMS Corporate Account - SBI',
  'LMS Corporate Account - Axis',
] as const;

export const PAYMENT_TYPE_OPTIONS = ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'UPI'] as const;

export const DEFAULT_DISBURSAL_PAYMENT_TYPE = 'IMPS';

/** Default remarks on the disbursal sheet send form (user may edit). */
export const DEFAULT_DISBURSAL_SHEET_REMARKS = 'Ok to disburse';

export const DISBURSAL_TYPE_OPTIONS = ['Auto', 'Manual'] as const;

export const FI_TYPE_OPTIONS = ['Online', 'Offline'] as const;

export const COLLECTION_MODE_OPTIONS = [
  'Cash',
  'UPI',
  'NEFT',
  'RTGS',
  'IMPS',
  'Cheque',
  'Auto Debit',
  'Payment Link',
] as const;

export const COLLECTION_STATUS_OPTIONS = [
  'Part Payment',
  'Close',
  'Payday Pre-Close',
  'Settlement',
] as const;

/** Before contractual repay date — Part Payment and Payday Pre-Close only. */
export const COLLECTION_STATUS_BEFORE_REPAY_OPTIONS = [
  'Part Payment',
  'Payday Pre-Close',
] as const;

/** On or after repay date — Close, Settlement, and Part Payment. */
export const COLLECTION_STATUS_ON_OR_AFTER_REPAY_OPTIONS = [
  'Close',
  'Settlement',
  'Part Payment',
] as const;

export function collectionStatusOptionsForRepayDate(
  collectionDateTimeLocal: string,
  repayDateIso: string | null | undefined,
): readonly string[] {
  if (!repayDateIso?.trim() || !collectionDateTimeLocal?.trim()) {
    return COLLECTION_STATUS_OPTIONS;
  }
  const collectionDate = collectionDateTimeLocal.slice(0, 10);
  const repayDate = repayDateIso.trim().slice(0, 10);
  if (!collectionDate || !repayDate) {
    return COLLECTION_STATUS_OPTIONS;
  }
  if (collectionDate < repayDate) {
    return COLLECTION_STATUS_BEFORE_REPAY_OPTIONS;
  }
  return COLLECTION_STATUS_ON_OR_AFTER_REPAY_OPTIONS;
}

export function isCollectionStatusAllowedForRepayDate(
  statusLabel: string,
  collectionDateTimeLocal: string,
  repayDateIso: string | null | undefined,
): boolean {
  const normalized = normalizeCollectionStatusForForm(statusLabel);
  if (!normalized) return false;
  const options = collectionStatusOptionsForRepayDate(collectionDateTimeLocal, repayDateIso);
  return options.includes(normalized);
}

export const COLLECTION_SOURCE_OPTIONS = [
  'Direct',
  'Field Visit',
  'Phone Call',
  'WhatsApp',
  'Payment Link',
  'Auto Recovery',
] as const;

export const REMARK_CATEGORY_OPTIONS = [
  'Promise to Pay (PTP)',
  'Follow Up',
  'Customer Not Reachable',
  'Settlement Discussion',
  'Legal Notice',
  'Other',
] as const;

export const REMARK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

const REMARK_CATEGORY_SLUG_TO_LABEL: Record<string, (typeof REMARK_CATEGORY_OPTIONS)[number]> = {
  follow_up: 'Follow Up',
  promise_to_pay: 'Promise to Pay (PTP)',
  ptp: 'Promise to Pay (PTP)',
  customer_not_reachable: 'Customer Not Reachable',
  settlement_discussion: 'Settlement Discussion',
  legal_notice: 'Legal Notice',
  other: 'Other',
};

export function normalizeRemarkCategoryForForm(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (REMARK_CATEGORY_SLUG_TO_LABEL[slug]) {
    return REMARK_CATEGORY_SLUG_TO_LABEL[slug];
  }
  const match = REMARK_CATEGORY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

export function normalizeRemarkPriorityForForm(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const match = REMARK_PRIORITY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

export function normalizeRemarkFollowUpDateForForm(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

const COLLECTION_MODE_SLUG_TO_LABEL: Record<string, (typeof COLLECTION_MODE_OPTIONS)[number]> = {
  cash: 'Cash',
  upi: 'UPI',
  neft: 'NEFT',
  rtgs: 'RTGS',
  imps: 'IMPS',
  cheque: 'Cheque',
  auto_debit: 'Auto Debit',
  payment_link: 'Payment Link',
};

export function normalizeCollectionModeForForm(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (COLLECTION_MODE_SLUG_TO_LABEL[slug]) {
    return COLLECTION_MODE_SLUG_TO_LABEL[slug];
  }
  const match = COLLECTION_MODE_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

const COLLECTION_STATUS_SLUG_TO_LABEL: Record<string, (typeof COLLECTION_STATUS_OPTIONS)[number]> = {
  part_payment: 'Part Payment',
  close: 'Close',
  closed: 'Close',
  payday_pre_close: 'Payday Pre-Close',
  settlement: 'Settlement',
};

export function normalizeCollectionStatusForForm(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (COLLECTION_STATUS_SLUG_TO_LABEL[slug]) {
    return COLLECTION_STATUS_SLUG_TO_LABEL[slug];
  }
  const match = COLLECTION_STATUS_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

export function mapCollectionStatusToApi(label: string): string | undefined {
  const normalized = normalizeCollectionStatusForForm(label);
  switch (normalized) {
    case 'Part Payment':
      return 'part_payment';
    case 'Close':
      return 'close';
    case 'Payday Pre-Close':
      return 'payday_pre_close';
    case 'Settlement':
      return 'settlement';
    default:
      return undefined;
  }
}

const COLLECTION_SOURCE_SLUG_TO_LABEL: Record<string, (typeof COLLECTION_SOURCE_OPTIONS)[number]> = {
  direct: 'Direct',
  field_visit: 'Field Visit',
  phone_call: 'Phone Call',
  whatsapp: 'WhatsApp',
  payment_link: 'Payment Link',
  auto_recovery: 'Auto Recovery',
};

export function normalizeCollectionSourceForForm(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (COLLECTION_SOURCE_SLUG_TO_LABEL[slug]) {
    return COLLECTION_SOURCE_SLUG_TO_LABEL[slug];
  }
  const match = COLLECTION_SOURCE_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

export function generateDisbursalReferenceNo(): string {
  return `DISB-${Date.now().toString().slice(-8)}`;
}
