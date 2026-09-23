import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast, sentEmailSuccessTitle } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import { sendSanctionApprovedEmail } from '@/lib/applicationsApi';
import {
  calculateSanctionFees,
  createLeadSanction,
  fetchLeadSanctionFormContext,
  mapSanctionFromApi,
  resolveProductPfPercentage,
  type ApiLeadSanction,
} from '@/lib/leadDetailsApi';
import { fetchBanks, type ApiBank } from '@/lib/banksApi';
import {
  SanctionSalaryBankMultiSelect,
  apiSalaryBanksToBankIds,
  bankIdsToApiSalaryBanks,
  validateSelectedBankIds,
  resolveSalaryBankIdsFromRecord,
} from '@/features/leads/components/SanctionSalaryAccountsTable';
import type { ApiLoanProduct } from '@/lib/applicationsApi';
import { resolveLoanProductLabel } from '@/lib/applicationsApi';
import {
  COUNT_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  LOAN_PURPOSE_OPTIONS,
  PF_PERCENTAGE_OPTIONS,
  RESIDENTIAL_TYPE_OPTIONS,
  ROI_OPTIONS,
  ensureNumericSelectOption,
  ensureSelectOption,
  getSanctionRepaymentDateBounds,
  resolveRepaymentTenureLimits,
  computeSanctionRepaymentTenureDays,
  validateSanctionRepaymentDate,
} from '@/features/leads/components/leadSanctionConstants';
import { fetchBankHolidayLabelMap } from '@/lib/bankHolidaysApi';
import { DatePicker } from '@/components/ui/date-picker';
import { BranchSelect } from '@/components/branches/BranchSelect';
import { LoadingState } from '@/components/ui/loading-state';
import {
  FormFieldLabel,
  FormSelect,
  GridDetailTable,
  SectionEditButton,
  SectionMailButton,
  textareaClassName,
} from '@/features/leads/components/leadDetailSectionShared';
import {
  digitsOnly,
  normalizeIndianMobile,
  validateMobile,
  validateCibilScore,
  normalizeCibilScore,
  validateSanctionLoanAmount,
  validateSanctionMonthlyObligation,
  normalizeNonNegativeDecimalInput,
  validateNonNegativeAmount,
} from '@/lib/indiaValidators';
import { formatRatePercent, formatCurrency } from '@/lib/utils';
import { formatAppDateField, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { startOfDay } from 'date-fns';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { Badge } from '@/components/ui/badge';
import { leadPipelineStatusBadgeClass } from '@/lib/badgeStyles';

export interface LoanSanctionEntry {
  productId: string;
  productName?: string;
  loanAmount: string;
  branch: string;
  roi: string;
  repaymentDate: string;
  officialEmail: string;
  alternateMobile: string;
  adminFees: string;
  pfPercentage: string;
  gst: string;
  monthlyIncome: string;
  cibilScore: string;
  plActive: string;
  hlActive: string;
  activePaydayLoan: string;
  monthlyObligation: string;
  residentialType: string;
  employmentType: string;
  loanPurpose: string;
  remarks: string;
  approvedOn: string;
  loanTenure: string;
  leadStatus: string;
  rejectionReason: string;
  sanctionedBy: string;
  amountToBeDisbursed: string;
  repayAmount: string;
  leadRemarks: string;
  salaryAccount: string;
  bank: string;
  salaryBankIds: string[];
  approvalStatus: string;
  matrixApprovedBy: string;
  approvalRemarks: string;
}

interface LeadLoanSanctionSectionProps {
  leadId: string;
  sanctionRecord: ApiLeadSanction | null;
  sanctionLoading?: boolean;
  /** Existing application id when lead is already converted — skips extra lead lookups on submit. */
  applicationId?: string | null;
  defaultEmail?: string;
  defaultAlternateMobile?: string;
  defaultMonthlyIncome?: string;
  defaultEmploymentType?: string;
  defaultLoanPurpose?: string;
  defaultResidentialType?: string;
  /** Create initial sanction (CM / approvers). */
  canCreate?: boolean;
  /** Update an existing sanction (Admin / Super Admin only). */
  canUpdate?: boolean;
  /** Admin / Super Admin only — ROI and processing fee % */
  canEditPricingFields?: boolean;
  /** Super Admin / Production Manager only — loan product dropdown */
  canChangeProduct?: boolean;
  onCancel?: () => void;
  onSaved?: (record: ApiLeadSanction) => void;
  onSanctionStateChange?: (hasSanction: boolean) => void;
}

function formatProductRoi(value: string | number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(2);
}

function sanitizeAmountInput(value: string): string {
  return normalizeNonNegativeDecimalInput(value);
}

function resolveProductRoi(product: ApiLoanProduct): string {
  const formatted = formatProductRoi(product.interest_rate);
  if (ROI_OPTIONS.includes(formatted)) {
    return formatted;
  }
  return formatted;
}

function formatGridAmount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? formatCurrency(numeric) : trimmed;
}

function formatGridTenure(days: string): string {
  const trimmed = days.trim();
  if (!trimmed) return '';
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return trimmed;
  return `${numeric} ${numeric === 1 ? 'day' : 'days'}`;
}

function formatGridCount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? String(numeric) : trimmed;
}

function sanctionStatusBadge(status: string | undefined): React.ReactNode {
  const label = status?.trim();
  if (!label) return '—';
  return <Badge className={leadPipelineStatusBadgeClass(label)}>{label}</Badge>;
}

function sanctionToGridItems(entry: LoanSanctionEntry, productName?: string) {
  const loanType = entry.productName || productName || '';

  return [
    { label: 'Approval Amount', value: formatGridAmount(entry.loanAmount) },
    { label: 'Loan Type', value: loanType },
    { label: 'ROI', value: entry.roi ? formatRatePercent(entry.roi) : '' },
    { label: 'Processing Fee %', value: entry.pfPercentage ? formatRatePercent(entry.pfPercentage) : '' },
    { label: 'Processing Fee', value: formatGridAmount(entry.adminFees) },
    { label: 'GST on Processing Fee', value: formatGridAmount(entry.gst) },
    { label: 'Branch', value: entry.branch },
    { label: 'Loan Tenure', value: formatGridTenure(entry.loanTenure) },
    { label: 'Repayment Date', value: formatAppDateField(entry.repaymentDate) },
    { label: 'Monthly Income', value: formatGridAmount(entry.monthlyIncome) },
    { label: 'Alternate Mobile', value: entry.alternateMobile },
    { label: 'Official Email', value: entry.officialEmail },
    { label: 'CIBIL Score', value: entry.cibilScore },
    { label: 'Active PL', value: formatGridCount(entry.plActive) },
    { label: 'Active HL', value: formatGridCount(entry.hlActive) },
    { label: 'Active Payday Loan', value: formatGridCount(entry.activePaydayLoan) },
    { label: 'Monthly Obligation', value: formatGridAmount(entry.monthlyObligation) },
    { label: 'Lead Status', value: sanctionStatusBadge(entry.leadStatus) },
    { label: 'Rejection Reason', value: entry.rejectionReason },
    { label: 'Employment Type', value: entry.employmentType },
    { label: 'Loan Required For', value: entry.loanPurpose },
    { label: 'Sanction Date', value: formatAppDateTimeOrFallback(entry.approvedOn) },
    { label: 'Amount to be Disbursed', value: formatGridAmount(entry.amountToBeDisbursed) },
    { label: 'Residential Type', value: entry.residentialType },
    { label: 'Repay Amount', value: formatGridAmount(entry.repayAmount) },
    { label: 'Lead Remarks', value: entry.leadRemarks },
    { label: 'Approval Status', value: sanctionStatusBadge(entry.approvalStatus) },
    { label: 'Matrix Approved By', value: entry.matrixApprovedBy },
    { label: 'Approval Remarks', value: entry.approvalRemarks },
    { label: 'Sanction By', value: entry.sanctionedBy },
  ];
}

const emptyForm = (
  defaults: Pick<
    LeadLoanSanctionSectionProps,
    | 'defaultEmail'
    | 'defaultAlternateMobile'
    | 'defaultMonthlyIncome'
    | 'defaultEmploymentType'
    | 'defaultLoanPurpose'
    | 'defaultResidentialType'
  >,
  productDefaults?: { productId?: string; roi?: string; pfPercentage?: string },
) => ({
  productId: productDefaults?.productId ?? '',
  loanAmount: '',
  confirmLoanAmount: '',
  branch: '',
  roi: productDefaults?.roi ?? '',
  repaymentDate: '',
  officialEmail: defaults.defaultEmail ?? '',
  alternateMobile: defaults.defaultAlternateMobile ?? '',
  adminFees: '',
  pfPercentage: productDefaults?.pfPercentage ?? '',
  gst: '',
  monthlyIncome: defaults.defaultMonthlyIncome ?? '',
  cibilScore: '',
  plActive: '',
  hlActive: '',
  activePaydayLoan: '',
  monthlyObligation: '',
  residentialType: defaults.defaultResidentialType ?? '',
  employmentType: defaults.defaultEmploymentType ?? '',
  loanPurpose: defaults.defaultLoanPurpose ?? '',
  remarks: '',
  salaryBankIds: [] as string[],
});

function sanctionEntryToForm(entry: LoanSanctionEntry, productId: string) {
  return {
    productId: entry.productId || productId,
    loanAmount: entry.loanAmount,
    confirmLoanAmount: entry.loanAmount,
    branch: entry.branch,
    roi: entry.roi,
    repaymentDate: entry.repaymentDate,
    officialEmail: entry.officialEmail,
    alternateMobile: entry.alternateMobile,
    adminFees: entry.adminFees,
    pfPercentage: entry.pfPercentage,
    gst: entry.gst,
    monthlyIncome: entry.monthlyIncome,
    cibilScore: entry.cibilScore,
    plActive: entry.plActive,
    hlActive: entry.hlActive,
    activePaydayLoan: entry.activePaydayLoan,
    monthlyObligation: entry.monthlyObligation,
    residentialType: entry.residentialType,
    employmentType: entry.employmentType,
    loanPurpose: entry.loanPurpose,
    remarks: entry.remarks,
    salaryBankIds: entry.salaryBankIds ?? [],
  };
}

export function LeadLoanSanctionSection({
  leadId,
  applicationId,
  sanctionRecord,
  sanctionLoading = false,
  defaultEmail,
  defaultAlternateMobile,
  defaultMonthlyIncome,
  defaultEmploymentType,
  defaultLoanPurpose,
  defaultResidentialType,
  canCreate = false,
  canUpdate = false,
  canEditPricingFields = false,
  canChangeProduct = false,
  onCancel,
  onSaved,
  onSanctionStateChange,
}: LeadLoanSanctionSectionProps) {
  const [form, setForm] = useState(() =>
    emptyForm({
      defaultEmail,
      defaultAlternateMobile,
      defaultMonthlyIncome,
      defaultEmploymentType,
      defaultLoanPurpose,
      defaultResidentialType,
    }),
  );
  const [banks, setBanks] = useState<ApiBank[]>([]);
  const [products, setProducts] = useState<ApiLoanProduct[]>([]);
  const [leadDefaults, setLeadDefaults] = useState({
    loanPurpose: defaultLoanPurpose ?? '',
    residentialType: defaultResidentialType ?? '',
  });
  const [productPricing, setProductPricing] = useState<ApiLoanProduct | null>(null);
  const [productPricingLoading, setProductPricingLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<LoanSanctionEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedApplicationId, setResolvedApplicationId] = useState<string | null>(applicationId ?? null);
  const [isSendingSanctionEmail, setIsSendingSanctionEmail] = useState(false);
  const [bankHolidayLabels, setBankHolidayLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (applicationId) {
      setResolvedApplicationId(applicationId);
    }
  }, [applicationId]);

  useEffect(() => {
    if (sanctionRecord?.application_id) {
      setResolvedApplicationId(sanctionRecord.application_id);
    }
  }, [sanctionRecord?.application_id]);

  const gstRatePercent = productPricing?.gst_percentage ?? '18';
  const showProductDropdown = canChangeProduct;
  const readOnlyFieldClass =
    'h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed';

  const productSelectOptions = useMemo(() => {
    const base = products.map((product) => ({
      value: product.id,
      label: resolveLoanProductLabel(product.id, products, { product }),
    }));
    if (form.productId && !base.some((option) => option.value === form.productId)) {
      return [
        ...base,
        {
          value: form.productId,
          label: resolveLoanProductLabel(form.productId, products, {
            productName: submitted?.productName,
            product: productPricing,
          }),
        },
      ];
    }
    return base;
  }, [products, form.productId, productPricing, submitted?.productName]);

  useEffect(() => {
    let cancelled = false;
    fetchBanks()
      .then((loadedBanks) => {
        if (!cancelled) setBanks(loadedBanks);
      })
      .catch((error) => {
        if (!cancelled) {
          setBanks([]);
          toast({
            title: 'Failed to load banks',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const residentialSelectOptions = useMemo(() => {
    const values = ensureSelectOption([...RESIDENTIAL_TYPE_OPTIONS], form.residentialType);
    return values.map((type) => ({ value: type, label: type }));
  }, [form.residentialType]);

  const loanPurposeSelectOptions = useMemo(() => {
    const values = ensureSelectOption([...LOAN_PURPOSE_OPTIONS], form.loanPurpose);
    return values.map((purpose) => ({ value: purpose, label: purpose }));
  }, [form.loanPurpose]);

  const roiSelectOptions = useMemo(() => {
    const productRoi = productPricing ? resolveProductRoi(productPricing) : '';
    const values = ensureNumericSelectOption(
      ensureNumericSelectOption(ROI_OPTIONS, productRoi, 'desc'),
      form.roi,
      'desc',
    );
    return values.map((roi) => ({ value: roi, label: `${roi}%` }));
  }, [form.roi, productPricing]);

  const pfSelectOptions = useMemo(() => {
    const productPf = productPricing ? resolveProductPfPercentage(productPricing) : '';
    const values = ensureNumericSelectOption(
      ensureNumericSelectOption(PF_PERCENTAGE_OPTIONS, productPf, 'desc'),
      form.pfPercentage,
      'desc',
    );
    return values.map((pf) => ({ value: pf, label: `${pf}%` }));
  }, [form.pfPercentage, productPricing]);

  const selectedProductName = useMemo(() => {
    const productId = submitted?.productId || form.productId;
    return resolveLoanProductLabel(productId, products, {
      productName: submitted?.productName,
      product: productPricing,
    });
  }, [products, form.productId, productPricing, submitted?.productId, submitted?.productName]);

  const repaymentTenureLimits = useMemo(
    () => resolveRepaymentTenureLimits(productPricing),
    [productPricing],
  );

  const expectedDisbursalDate = useMemo(() => startOfDay(new Date()), []);

  const repaymentDateBounds = useMemo(
    () => getSanctionRepaymentDateBounds(expectedDisbursalDate, repaymentTenureLimits),
    [expectedDisbursalDate, repaymentTenureLimits],
  );

  const repaymentCalendarAvailability = useMemo(
    () => ({
      disableSundays: true,
      holidayLabelsByIsoDate: bankHolidayLabels,
    }),
    [bankHolidayLabels],
  );

  useEffect(() => {
    let cancelled = false;
    fetchBankHolidayLabelMap()
      .then((labels) => {
        if (!cancelled) setBankHolidayLabels(labels);
      })
      .catch(() => {
        if (!cancelled) setBankHolidayLabels({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const repaymentTenureDays = useMemo(
    () =>
      computeSanctionRepaymentTenureDays(
        form.repaymentDate,
        repaymentTenureLimits,
        expectedDisbursalDate,
        bankHolidayLabels,
      ),
    [form.repaymentDate, repaymentTenureLimits, expectedDisbursalDate, bankHolidayLabels],
  );

  useEffect(() => {
    if (!sanctionRecord) {
      setSubmitted(null);
      setIsEditing(false);
      return;
    }
    const mapped = mapSanctionFromApi(sanctionRecord);
    setSubmitted({
      ...mapped,
      productId: mapped.productId || productPricing?.id || '',
      productName: mapped.productName || productPricing?.product_name || '',
      salaryBankIds: resolveSalaryBankIdsFromRecord(sanctionRecord, banks),
    });
    setIsEditing(false);
  }, [sanctionRecord, productPricing?.id, productPricing?.product_name, banks]);

  useEffect(() => {
    if (!isEditing || !sanctionRecord || !banks.length) {
      return;
    }
    const resolvedIds = resolveSalaryBankIdsFromRecord(sanctionRecord, banks);
    if (!resolvedIds.length) {
      return;
    }
    setForm((prev) =>
      prev.salaryBankIds.length ? prev : { ...prev, salaryBankIds: resolvedIds },
    );
  }, [isEditing, sanctionRecord, banks]);

  useEffect(() => {
    onSanctionStateChange?.(Boolean(submitted) && !isEditing);
  }, [submitted, isEditing, onSanctionStateChange]);

  useEffect(() => {
    let cancelled = false;
    setProductPricingLoading(true);
    fetchLeadSanctionFormContext(leadId)
      .then(
        ({
          products: loadedProducts,
          initialProductId,
          selectedProduct,
          defaultLoanPurpose: loadedLoanPurpose,
          defaultResidentialType: loadedResidentialType,
        }) => {
        if (cancelled) return;
        setProducts(loadedProducts);
        setProductPricing(selectedProduct);
        setLeadDefaults({
          loanPurpose: loadedLoanPurpose,
          residentialType: loadedResidentialType,
        });
        if (!sanctionRecord && !isEditing && selectedProduct) {
          setForm((prev) => ({
            ...prev,
            productId: prev.productId || initialProductId,
            roi: prev.roi || resolveProductRoi(selectedProduct),
            pfPercentage: prev.pfPercentage || resolveProductPfPercentage(selectedProduct),
            loanPurpose: prev.loanPurpose || loadedLoanPurpose,
            residentialType: prev.residentialType || loadedResidentialType,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            productId: prev.productId || initialProductId,
            loanPurpose: prev.loanPurpose || loadedLoanPurpose,
            residentialType: prev.residentialType || loadedResidentialType,
          }));
        }
      },
      )
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setProductPricing(null);
        }
      })
      .finally(() => {
        if (!cancelled) setProductPricingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    const principal = form.loanAmount.trim();
    const pfPercentage = form.pfPercentage.trim();
    const principalAmount = Number(principal);

    if (!principal && !pfPercentage) {
      setForm((prev) => ({ ...prev, adminFees: '', gst: '' }));
      return () => {
        cancelled = true;
      };
    }

    if (!Number.isFinite(principalAmount) || principalAmount < 0) {
      setForm((prev) => ({ ...prev, adminFees: '', gst: '' }));
      return () => {
        cancelled = true;
      };
    }

    calculateSanctionFees(principal || '0', pfPercentage || '0', gstRatePercent)
      .then((result) => {
        if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            adminFees: result.processing_fee,
            gst: result.gst,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setForm((prev) => ({ ...prev, adminFees: '', gst: '' }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.loanAmount, form.pfPercentage, gstRatePercent]);

  const handleProductChange = (productId: string) => {
    if (!canChangeProduct) return;
    const product = products.find((item) => item.id === productId) ?? null;
    setProductPricing(product);
    const limits = resolveRepaymentTenureLimits(product);
    setForm((prev) => {
      const repaymentDate = validateSanctionRepaymentDate(
        prev.repaymentDate,
        limits,
        expectedDisbursalDate,
        bankHolidayLabels,
      )
        ? ''
        : prev.repaymentDate;
      return {
        ...prev,
        productId,
        roi: product ? resolveProductRoi(product) : prev.roi,
        pfPercentage: product ? resolveProductPfPercentage(product) : prev.pfPercentage,
        repaymentDate,
      };
    });
  };

  const handleCancel = () => {
    if (submitted && isEditing) {
      setIsEditing(false);
      setFormError(null);
      return;
    }
    const reset = emptyForm(
      {
        defaultEmail,
        defaultAlternateMobile,
        defaultMonthlyIncome,
        defaultEmploymentType,
        defaultLoanPurpose: leadDefaults.loanPurpose,
        defaultResidentialType: leadDefaults.residentialType,
      },
      productPricing
        ? {
            productId: productPricing.id,
            roi: resolveProductRoi(productPricing),
            pfPercentage: resolveProductPfPercentage(productPricing),
          }
        : undefined,
    );
    setForm(reset);
    setFormError(null);
    onCancel?.();
  };

  const handleEdit = () => {
    if (!submitted || !canUpdate) return;
    const editProductId = submitted.productId || form.productId || productPricing?.id || '';
    const matchedProduct = products.find((product) => product.id === editProductId) ?? productPricing;
    if (matchedProduct) {
      setProductPricing(matchedProduct);
    }
    setForm(sanctionEntryToForm(submitted, editProductId));
    setFormError(null);
    setIsEditing(true);
  };

  const handleSubmit = async () => {
    if (isEditing ? !canUpdate : !canCreate) {
      setFormError('You do not have permission to perform this action.');
      return;
    }
    if (!form.loanAmount.trim()) {
      setFormError('Loan amount is required.');
      return;
    }
    const loanAmountNegativeError = validateNonNegativeAmount(form.loanAmount, {
      required: true,
      allowZero: false,
      label: 'Loan amount',
    });
    if (loanAmountNegativeError) {
      setFormError(loanAmountNegativeError);
      return;
    }
    if (!form.confirmLoanAmount.trim()) {
      setFormError('Confirm loan amount is required.');
      return;
    }
    const confirmLoanAmountNegativeError = validateNonNegativeAmount(form.confirmLoanAmount, {
      required: true,
      allowZero: false,
      label: 'Confirm loan amount',
    });
    if (confirmLoanAmountNegativeError) {
      setFormError(confirmLoanAmountNegativeError);
      return;
    }
    if (form.loanAmount.trim() !== form.confirmLoanAmount.trim()) {
      setFormError('Loan amount and confirm loan amount do not match.');
      return;
    }
    if (!form.productId.trim()) {
      setFormError('Loan product is required.');
      return;
    }
    if (!form.branch.trim()) {
      setFormError('Branch is required.');
      return;
    }
    const repaymentDateError = validateSanctionRepaymentDate(
      form.repaymentDate,
      repaymentTenureLimits,
      expectedDisbursalDate,
      bankHolidayLabels,
    );
    if (repaymentDateError) {
      setFormError(repaymentDateError);
      return;
    }
    const alternateMobileError = validateMobile(form.alternateMobile, { label: 'Alternate mobile number' });
    if (alternateMobileError) {
      setFormError(alternateMobileError);
      return;
    }
    const cibilScoreError = validateCibilScore(form.cibilScore, { required: true });
    if (cibilScoreError) {
      setFormError(cibilScoreError);
      return;
    }
    const loanAmountError = validateSanctionLoanAmount(form.loanAmount, form.monthlyIncome);
    if (loanAmountError) {
      setFormError(loanAmountError);
      return;
    }
    const monthlyIncomeError = validateNonNegativeAmount(form.monthlyIncome, {
      required: true,
      allowZero: false,
      label: 'Monthly income',
    });
    if (monthlyIncomeError) {
      setFormError(monthlyIncomeError);
      return;
    }
    const monthlyObligationError = validateSanctionMonthlyObligation(
      form.monthlyObligation,
      form.monthlyIncome,
    );
    if (monthlyObligationError) {
      setFormError(monthlyObligationError);
      return;
    }
    const salaryBanksError = validateSelectedBankIds(form.salaryBankIds);
    if (salaryBanksError) {
      setFormError(salaryBanksError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const record = await createLeadSanction(leadId, {
        loanAmount: form.loanAmount.trim(),
        productId: form.productId.trim(),
        branch: form.branch,
        roi: form.roi,
        repaymentDate: form.repaymentDate.trim(),
        officialEmail: form.officialEmail.trim(),
        alternateMobile: normalizeIndianMobile(form.alternateMobile),
        pfPercentage: form.pfPercentage.trim(),
        gstRatePercent,
        monthlyIncome: form.monthlyIncome.trim(),
        cibilScore: normalizeCibilScore(form.cibilScore),
        plActive: form.plActive,
        hlActive: form.hlActive,
        activePaydayLoan: form.activePaydayLoan,
        monthlyObligation: form.monthlyObligation.trim(),
        residentialType: form.residentialType,
        employmentType: form.employmentType,
        loanPurpose: form.loanPurpose,
        remarks: form.remarks.trim(),
        salaryBanks: bankIdsToApiSalaryBanks(form.salaryBankIds, banks),
      }, {
        product: productPricing,
        applicationId: applicationId ?? undefined,
        bankHolidayLabels,
      });
      if (record.application_id) {
        setResolvedApplicationId(record.application_id);
      }
      setSubmitted({
        ...mapSanctionFromApi(record),
        productId: form.productId.trim(),
        productName: selectedProductName || record.product_name || '',
        salaryBankIds: resolveSalaryBankIdsFromRecord(record, banks),
      });
      setIsEditing(false);
      toast({ title: isEditing ? 'Loan sanction updated' : 'Loan sanction saved', variant: 'success' });
      onSaved?.(record);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSanctionEmail = async () => {
    const applicationIdToSend = resolvedApplicationId || sanctionRecord?.application_id || applicationId;
    const recipientEmail = submitted?.officialEmail || form.officialEmail || defaultEmail;
    if (!applicationIdToSend) {
      toast({
        title: 'Failed to send sanction email',
        description: 'Application is missing.',
        variant: 'error',
      });
      return;
    }
    setIsSendingSanctionEmail(true);
    try {
      await sendSanctionApprovedEmail(applicationIdToSend);
      toast({
        title: sentEmailSuccessTitle('Sanction email', recipientEmail),
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Failed to send sanction email',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSendingSanctionEmail(false);
    }
  };

  if ((sanctionLoading && !submitted) || productPricingLoading) {
    return <LoadingState layout="section" message="Loading sanction details…" size="sm" />;
  }

  if (submitted && !isEditing) {
    return (
      <div className="space-y-4">
        <GridDetailTable
          items={sanctionToGridItems(submitted, selectedProductName)}
          columnsPerRow={6}
          compact
          title="Sanction Details"
          headerAction={
            <div className="flex items-center gap-1">
              {resolvedApplicationId && (canCreate || canUpdate) ? (
                <SectionMailButton
                  onClick={handleSendSanctionEmail}
                  disabled={isSendingSanctionEmail}
                  loading={isSendingSanctionEmail}
                  title="Send sanction email"
                />
              ) : null}
              {canUpdate ? (
                <SectionEditButton onClick={handleEdit} title="Edit sanction details" />
              ) : null}
            </div>
          }
        />
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Salary Account</p>
          <SanctionSalaryBankMultiSelect
            selectedBankIds={submitted.salaryBankIds ?? []}
            banks={banks}
            onChange={() => undefined}
            readOnly
          />
        </div>
      </div>
    );
  }

  if (!canCreate && !canUpdate) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        You do not have permission to sanction this loan.
      </p>
    );
  }

  if (!canCreate && !isEditing) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        You do not have permission to update sanction details.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {isEditing && (
        <p className="text-[11px] font-semibold text-primary-deep dark:text-indigo-300">
          Editing sanction details
        </p>
      )}

      <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <FormFieldLabel required>Loan Amount</FormFieldLabel>
            <Input
              type="number"
              min={0}
              value={form.loanAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, loanAmount: sanitizeAmountInput(e.target.value) }))
              }
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
              }}
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Confirm Loan Amount</FormFieldLabel>
            <Input
              type="password"
              value={form.confirmLoanAmount}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  confirmLoanAmount: sanitizeAmountInput(e.target.value),
                }))
              }
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
              }}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('Confirm Loan Amount')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Branch</FormFieldLabel>
            <BranchSelect
              value={form.branch}
              onChange={(branch) => setForm((prev) => ({ ...prev, branch }))}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Repayment Date</FormFieldLabel>
            <DatePicker
              value={form.repaymentDate}
              onChange={(repaymentDate) => setForm((prev) => ({ ...prev, repaymentDate }))}
              placeholder={selectPlaceholder('Repayment Date')}
              minDate={repaymentDateBounds.minDate}
              maxDate={repaymentDateBounds.maxDate}
              defaultMonth={repaymentDateBounds.minDate}
              boundedRange
              availability={repaymentCalendarAvailability}
              size="sm"
              triggerClassName="h-8 text-[11px]"
              inDialog
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {repaymentTenureDays != null
                ? `Tenure: ${repaymentTenureDays} ${repaymentTenureDays === 1 ? 'day' : 'days'}`
                : 'Sundays and bank holidays are not selectable.'}
            </p>
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Official Email</FormFieldLabel>
            <Input
              type="email"
              value={form.officialEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, officialEmail: e.target.value }))}
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Alternate Mobile</FormFieldLabel>
            <Input
              value={form.alternateMobile}
              onChange={(e) => setForm((prev) => ({ ...prev, alternateMobile: digitsOnly(e.target.value, 10) }))}
              className="h-8 text-[11px]"
              maxLength={10}
              inputMode="numeric"
              placeholder={enterPlaceholder('Mobile Number')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Monthly Income</FormFieldLabel>
            <Input
              type="number"
              min={0}
              value={form.monthlyIncome}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, monthlyIncome: sanitizeAmountInput(e.target.value) }))
              }
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
              }}
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>CIBIL Score</FormFieldLabel>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={form.cibilScore}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, cibilScore: normalizeCibilScore(e.target.value) }))
              }
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('CIBIL Score (300–900)')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Loan Product</FormFieldLabel>
            {showProductDropdown ? (
              <FormSelect
                value={form.productId}
                onChange={handleProductChange}
                placeholder={selectPlaceholder('Loan Product')}
                options={productSelectOptions}
              />
            ) : (
              <Input
                readOnly
                value={selectedProductName || '—'}
                className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
              />
            )}
          </div>
          <div className="space-y-1">
            <FormFieldLabel>ROI</FormFieldLabel>
            {canEditPricingFields ? (
              <FormSelect
                value={form.roi}
                onChange={(roi) => setForm((prev) => ({ ...prev, roi }))}
                placeholder={selectPlaceholder('ROI')}
                options={roiSelectOptions}
              />
            ) : (
              <Input
                readOnly
                value={form.roi ? `${form.roi}%` : '—'}
                className={readOnlyFieldClass}
              />
            )}
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Processing Fee %</FormFieldLabel>
            {canEditPricingFields ? (
              <FormSelect
                value={form.pfPercentage}
                onChange={(pfPercentage) => setForm((prev) => ({ ...prev, pfPercentage }))}
                placeholder={selectPlaceholder('Processing Fee %')}
                options={pfSelectOptions}
              />
            ) : (
              <Input
                readOnly
                value={form.pfPercentage ? `${form.pfPercentage}%` : '—'}
                className={readOnlyFieldClass}
              />
            )}
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Processing Fee</FormFieldLabel>
            <Input
              type="number"
              value={form.adminFees}
              readOnly
              className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
              placeholder={enterPlaceholder('Auto-calculated')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>GST</FormFieldLabel>
            <Input
              type="number"
              value={form.gst}
              readOnly
              className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
              placeholder={enterPlaceholder(`Auto-calculated (${gstRatePercent}%)`)}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>PL Active</FormFieldLabel>
            <FormSelect
              value={form.plActive}
              onChange={(plActive) => setForm((prev) => ({ ...prev, plActive }))}
              placeholder={selectPlaceholder('PL Active')}
              options={COUNT_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>HL Active</FormFieldLabel>
            <FormSelect
              value={form.hlActive}
              onChange={(hlActive) => setForm((prev) => ({ ...prev, hlActive }))}
              placeholder={selectPlaceholder('HL Active')}
              options={COUNT_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Active Payday Loan</FormFieldLabel>
            <FormSelect
              value={form.activePaydayLoan}
              onChange={(activePaydayLoan) => setForm((prev) => ({ ...prev, activePaydayLoan }))}
              placeholder={selectPlaceholder('Active Payday Loan')}
              options={COUNT_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Monthly Obligation</FormFieldLabel>
            <Input
              type="number"
              min={0}
              value={form.monthlyObligation}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  monthlyObligation: sanitizeAmountInput(e.target.value),
                }))
              }
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
              }}
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Address Type</FormFieldLabel>
            <FormSelect
              value={form.residentialType}
              onChange={(residentialType) => setForm((prev) => ({ ...prev, residentialType }))}
              placeholder={selectPlaceholder('Address Type')}
              options={residentialSelectOptions}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Employment Type</FormFieldLabel>
            <FormSelect
              value={form.employmentType}
              onChange={(employmentType) => setForm((prev) => ({ ...prev, employmentType }))}
              placeholder={selectPlaceholder('Employment Type')}
              options={EMPLOYMENT_TYPE_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel>Loan Purpose</FormFieldLabel>
            <FormSelect
              value={form.loanPurpose}
              onChange={(loanPurpose) => setForm((prev) => ({ ...prev, loanPurpose }))}
              placeholder={selectPlaceholder('Loan Purpose')}
              options={loanPurposeSelectOptions}
            />
          </div>
          <SanctionSalaryBankMultiSelect
            selectedBankIds={form.salaryBankIds}
            banks={banks}
            onChange={(salaryBankIds) => setForm((prev) => ({ ...prev, salaryBankIds }))}
          />
          <div className="space-y-1 md:col-span-2 lg:col-span-4">
            <FormFieldLabel>Remarks</FormFieldLabel>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              className={textareaClassName}
            />
          </div>
        </div>

        {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg px-4"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isEditing ? 'Update Sanction' : 'Sanction'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold rounded-lg px-4 border-slate-200"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
