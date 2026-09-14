import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import {
  createLeadDisbursal,
  fetchLeadDisbursal,
  mapDisbursalFromApi,
  mapLoanSummaryFromApi,
  type ApiCompanyAccountProfile,
  type ApiDisbursalResponse,
} from '@/lib/leadDetailsApi';
import {
  FormFieldLabel,
  FormSelect,
  GridDetailTable,
  SectionEditButton,
  type GridDetailItem,
  textareaClassName,
} from '@/features/leads/components/leadDetailSectionShared';
import {
  DEFAULT_DISBURSAL_PAYMENT_TYPE,
  DEFAULT_DISBURSAL_SHEET_REMARKS,
  DISBURSAL_TYPE_OPTIONS,
  FI_TYPE_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  generateDisbursalReferenceNo,
} from '@/features/leads/components/leadDisbursalConstants';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback, formatAppDateTimeWithSecondsOrFallback, getToday, validateFiDateNotAfterToday } from '@/lib/dateUtils';
import { LoadingState } from '@/components/ui/loading-state';
import { formatCurrency, formatRatePercent } from '@/lib/utils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import {
  normalizeChequeNo,
  upperAlphanumeric,
  validateChequeNo,
  validateIfsc,
} from '@/lib/indiaValidators';
import { useIfscAutofill } from '@/hooks/useIfscAutofill';

export interface DisbursalEntry {
  loanNo: string;
  companyAccount: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  chequeNo: string;
  enachId: string;
  fiDate: string;
  fiType: string;
  fiDoneBy: string;
  amountToBeDisbursed: string;
  totalDeduction: string;
  disbursalReferenceNo: string;
  paymentType: string;
  disbursalDate: string;
  disbursalSheetDate: string;
  disbursalType: string;
  repayAmount: string;
  repayDate: string;
  status: string;
  disbursedBy: string;
  leadTransferToLegal: string;
  leadTransferDate: string;
  remarks: string;
  disbursedOn: string;
}

interface CompletionFormState {
  disbursalReferenceNo: string;
  disbursalType: string;
  paymentType: string;
  remarks: string;
}

export interface LoanSummaryDetails {
  branch: string;
  loanDisbursed: string;
  roi: string;
  numberOfDays: string;
  realDays: string;
  penaltyDays: string;
  realInterest: string;
  penaltyInterest: string;
  paidAmount: string;
  tillDateAmount: string;
  repayAmount: string;
}

interface LeadDisbursedSectionProps {
  leadId: string;
  defaultBranch?: string;
  defaultSalaryAccount?: string;
  defaultLoanAmount?: string;
  defaultRoi?: string;
  refreshKey?: number;
  canEdit?: boolean;
  /** CM: send disbursal sheet (disbursal.send). */
  canSendSheet?: boolean;
  /** Account & finance: complete disbursement (disbursal.create). */
  canCompleteDisbursement?: boolean;
  onDisbursed?: (statusDisplay: string) => void;
}

const emptyForm = () => ({
  companyAccount: '',
  accountNumber: '',
  ifscCode: '',
  bankName: '',
  branch: '',
  chequeNo: '',
  enachId: '',
  fiDate: '',
  fiType: '',
  fiDoneBy: '',
  amountToBeDisbursed: '',
  totalDeduction: '',
  disbursalReferenceNo: '',
  paymentType: DEFAULT_DISBURSAL_PAYMENT_TYPE,
  disbursalDate: '',
  remarks: DEFAULT_DISBURSAL_SHEET_REMARKS,
});


const emptyCompletionForm = (): CompletionFormState => ({
  disbursalReferenceNo: '',
  disbursalType: 'Manual',
  paymentType: '',
  remarks: '',
});

function buildCompletionFormFromSheet(mappedDisbursal: DisbursalEntry): CompletionFormState {
  return {
    disbursalReferenceNo: '',
    disbursalType: mappedDisbursal.disbursalType || 'Manual',
    paymentType: mappedDisbursal.paymentType,
    remarks: mappedDisbursal.remarks,
  };
}

function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  const num = Number(value);
  return Number.isFinite(num) ? formatCurrency(num) : String(value);
}

function disbursalStatusText(status: string | undefined): React.ReactNode {
  const label = status?.trim();
  if (!label) return '—';
  return (
    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
      {label}
    </span>
  );
}

function buildDisbursalDetailItems(
  entry: DisbursalEntry,
  options?: { isDisbursedComplete?: boolean },
): GridDetailItem[] {
  const isDisbursedComplete = options?.isDisbursedComplete ?? false;
  return [
    { label: 'Loan No.', value: entry.loanNo || '' },
    { label: 'Disbursal Sheet Date', value: formatAppDateTimeWithSecondsOrFallback(entry.disbursalSheetDate) },
    {
      label: 'Disbursal Date',
      value: isDisbursedComplete
        ? formatAppDateTimeOrFallback(entry.disbursalDate)
        : '',
    },
    { label: 'Disbursal Amount', value: formatAmount(entry.amountToBeDisbursed) },
    { label: 'Repay Amount', value: formatAmount(entry.repayAmount) },
    { label: 'Account No.', value: entry.accountNumber || '' },
    { label: 'IFSC Code', value: entry.ifscCode || '' },
    { label: 'Bank Name', value: entry.bankName || '' },
    { label: 'Bank Branch', value: entry.branch || '' },
    { label: 'Cheque No.', value: entry.chequeNo || '' },
    { label: 'E-Nach ID', value: entry.enachId || '' },
    { label: 'Loan UTR No.', value: entry.disbursalReferenceNo || '' },
    { label: 'FI Done By', value: entry.fiDoneBy || '' },
    { label: 'FI Type', value: entry.fiType || '' },
    { label: 'Disbursed By', value: entry.disbursedBy || '' },
    { label: 'Status', value: disbursalStatusText(entry.status) },
    { label: 'Repay Date', value: formatAppDateOrFallback(entry.repayDate) },
    { label: 'Remarks', value: entry.remarks || '' },
    { label: 'Disbursal Type', value: entry.disbursalType || '' },
    { label: 'Lead Transfer to Legal', value: entry.leadTransferToLegal || '' },
    { label: 'Lead Transfer Date', value: formatAppDateOrFallback(entry.leadTransferDate) },
  ];
}

function buildLoanSummaryItems(summary: LoanSummaryDetails): GridDetailItem[] {
  const hasPenaltyInterest = Number(summary.penaltyInterest) > 0;
  const tillDateClassName = hasPenaltyInterest
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-indigo-600 dark:text-indigo-400';

  return [
    { label: 'Branch', value: summary.branch || '' },
    { label: 'Loan Amount', value: formatAmount(summary.loanDisbursed) },
    { label: 'ROI', value: formatRatePercent(summary.roi) },
    { label: 'Tenure', value: summary.numberOfDays || '' },
    { label: 'Real Days', value: summary.realDays || '' },
    { label: 'Real Interest', value: formatAmount(summary.realInterest) },
    { label: 'Penalty Days', value: summary.penaltyDays || '' },
    {
      label: 'Penalty Interest',
      value: formatAmount(summary.penaltyInterest),
      valueClassName: hasPenaltyInterest ? 'text-rose-600 dark:text-rose-400' : undefined,
    },
    { label: 'Paid Amount', value: formatAmount(summary.paidAmount) },
    {
      label: 'Till Date Amount',
      value: formatAmount(summary.tillDateAmount),
      valueClassName: tillDateClassName,
    },
  ];
}

function buildDefaultLoanSummary(
  defaults: Pick<LeadDisbursedSectionProps, 'defaultBranch' | 'defaultLoanAmount' | 'defaultRoi'>,
): LoanSummaryDetails {
  const amount = defaults.defaultLoanAmount || '0';
  const roi = defaults.defaultRoi || '0.75';
  return {
    branch: defaults.defaultBranch ?? '',
    loanDisbursed: amount,
    roi,
    numberOfDays: '',
    realDays: '',
    penaltyDays: '',
    realInterest: '0',
    penaltyInterest: '0',
    paidAmount: '0',
    tillDateAmount: amount,
    repayAmount: amount,
  };
}

export function LeadDisbursedSection({
  leadId,
  defaultBranch,
  defaultSalaryAccount,
  defaultLoanAmount,
  defaultRoi,
  refreshKey = 0,
  canEdit = false,
  canSendSheet = false,
  canCompleteDisbursement = false,
  onDisbursed,
}: LeadDisbursedSectionProps) {
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    amountToBeDisbursed: '',
    totalDeduction: '',
  }));
  const [companyAccountProfile, setCompanyAccountProfile] =
    useState<ApiCompanyAccountProfile | null>(null);
  const [completionForm, setCompletionForm] = useState<CompletionFormState>(emptyCompletionForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [disbursed, setDisbursed] = useState<DisbursalEntry | null>(null);
  const [disbursalStage, setDisbursalStage] = useState<'none' | 'sheet_sent' | 'disbursed'>('none');
  const [applicationStatus, setApplicationStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loanSummary, setLoanSummary] = useState<LoanSummaryDetails>(() =>
    buildDefaultLoanSummary({ defaultBranch, defaultLoanAmount, defaultRoi }),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [netDisbursal, setNetDisbursal] = useState<ApiDisbursalResponse['net_disbursal']>(null);
  const [fiDoneByOptions, setFiDoneByOptions] = useState<string[]>([]);
  const [ifscLookupError, setIfscLookupError] = useState<string | null>(null);
  const { lookupIfsc, isLookingUp: isIfscLookingUp } = useIfscAutofill();

  const handleIfscChange = (value: string) => {
    const ifscCode = upperAlphanumeric(value, 11);
    setForm((prev) => ({
      ...prev,
      ifscCode,
      bankName: ifscCode.length === 11 ? prev.bankName : '',
      branch: ifscCode.length === 11 ? prev.branch : '',
    }));
    setIfscLookupError(null);

    lookupIfsc(
      ifscCode,
      (details) => {
        setForm((prev) => ({
          ...prev,
          ifscCode: details.ifsc_code,
          bankName: details.bank_name,
          branch: details.branch,
        }));
        setIfscLookupError(null);
      },
      (message) => {
        setForm((prev) => ({ ...prev, bankName: '', branch: '' }));
        setIfscLookupError(message);
      },
    );
  };

  const loadDisbursal = useCallback(async () => {
    if (!leadId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetchLeadDisbursal(leadId);
      const mappedDisbursal = response.disbursal ? mapDisbursalFromApi(response.disbursal) : null;
      const appStatus = response.application_status ?? '';
      let stage = response.stage ?? 'none';
      if (stage === 'none' && mappedDisbursal) {
        stage = appStatus === 'disbursal_sheet_sent' ? 'sheet_sent' : 'disbursed';
      }
      const mappedSummary = mapLoanSummaryFromApi(response.loan_summary);
      const net = response.net_disbursal ?? null;
      setNetDisbursal(net);
      const rosterNames = (response.fi_investigators ?? []).map((investigator) => investigator.name);
      const savedFiDoneBy = response.disbursal
        ? mapDisbursalFromApi(response.disbursal).fiDoneBy
        : '';
      setFiDoneByOptions(
        savedFiDoneBy && !rosterNames.includes(savedFiDoneBy)
          ? [...rosterNames, savedFiDoneBy]
          : rosterNames,
      );
      const netAmount = net?.amount_to_be_disbursed ?? '';
      const netDeduction = net?.total_deduction ?? '';
      const profile = response.company_account_profile ?? null;
      setCompanyAccountProfile(profile);
      setApplicationStatus(appStatus);
      setDisbursalStage(stage);
      setIsEditing(false);
      setLoanSummary(mappedSummary);
      if (mappedDisbursal) {
        const statusDisplay = response.application_status_display ?? mappedDisbursal.status;
        const enrichedDisbursal: DisbursalEntry = {
          ...mappedDisbursal,
          status: statusDisplay || mappedDisbursal.status,
        };
        setDisbursed(enrichedDisbursal);
        setForm({
          companyAccount: enrichedDisbursal.companyAccount,
          accountNumber: enrichedDisbursal.accountNumber,
          ifscCode: enrichedDisbursal.ifscCode,
          bankName: enrichedDisbursal.bankName,
          branch: enrichedDisbursal.branch,
          chequeNo: enrichedDisbursal.chequeNo,
          enachId: enrichedDisbursal.enachId,
          fiDate: enrichedDisbursal.fiDate,
          fiType: enrichedDisbursal.fiType,
          fiDoneBy: enrichedDisbursal.fiDoneBy,
          amountToBeDisbursed: netAmount || enrichedDisbursal.amountToBeDisbursed,
          totalDeduction: netDeduction || enrichedDisbursal.totalDeduction,
          disbursalReferenceNo:
            response.stage === 'disbursed' ? enrichedDisbursal.disbursalReferenceNo : '',
          paymentType: enrichedDisbursal.paymentType,
          disbursalDate: enrichedDisbursal.disbursalDate,
          remarks: enrichedDisbursal.remarks,
        });
        if (stage === 'sheet_sent') {
          setCompletionForm(buildCompletionFormFromSheet(enrichedDisbursal));
        } else {
          setCompletionForm(emptyCompletionForm());
        }
      } else {
        setDisbursed(null);
        const sheetDefaults = response.disbursal_defaults;
        const prefilledAccountNumber =
          sheetDefaults?.account_number?.trim() || defaultSalaryAccount?.trim() || '';
        setForm({
          ...emptyForm(),
          companyAccount: profile?.account_number ?? '',
          accountNumber: prefilledAccountNumber,
          ifscCode: sheetDefaults?.ifsc_code ?? '',
          bankName: sheetDefaults?.bank_name ?? '',
          branch: sheetDefaults?.branch ?? '',
          amountToBeDisbursed: netAmount,
          totalDeduction: netDeduction,
        });
        const prefilledIfsc = sheetDefaults?.ifsc_code?.trim();
        if (prefilledIfsc) {
          lookupIfsc(
            prefilledIfsc,
            (details) => {
              setForm((prev) => ({
                ...prev,
                ifscCode: details.ifsc_code,
                bankName: details.bank_name,
                branch: details.branch,
              }));
            },
            () => undefined,
          );
        }
      }
    } catch {
      toast({ title: 'Failed to load disbursal details', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [leadId, defaultSalaryAccount, refreshKey, lookupIfsc]);

  useEffect(() => {
    if (disbursalStage !== 'none' || isEditing || !defaultSalaryAccount?.trim()) {
      return;
    }
    setForm((prev) => {
      if (prev.accountNumber.trim()) {
        return prev;
      }
      return { ...prev, accountNumber: defaultSalaryAccount.trim() };
    });
  }, [defaultSalaryAccount, disbursalStage, isEditing]);

  useEffect(() => {
    loadDisbursal();
  }, [loadDisbursal]);

  const handleRefreshReference = () => {
    setCompletionForm((prev) => ({
      ...prev,
      disbursalReferenceNo: generateDisbursalReferenceNo(),
    }));
  };

  const handleCancel = () => {
    if (disbursed && isEditing) {
      setIsEditing(false);
      setFormError(null);
      return;
    }
    setForm({
      ...emptyForm(),
      companyAccount: companyAccountProfile?.account_number ?? '',
      amountToBeDisbursed: '',
      totalDeduction: '',
    });
    setFormError(null);
  };

  const handleEdit = () => {
    if (!disbursed || disbursalStage !== 'sheet_sent') return;
    setForm({
      companyAccount: disbursed.companyAccount,
      accountNumber: disbursed.accountNumber,
      ifscCode: disbursed.ifscCode,
      bankName: disbursed.bankName,
      branch: disbursed.branch,
      chequeNo: disbursed.chequeNo,
      enachId: disbursed.enachId,
      fiDate: disbursed.fiDate,
      fiType: disbursed.fiType,
      fiDoneBy: disbursed.fiDoneBy,
      amountToBeDisbursed: disbursed.amountToBeDisbursed,
      totalDeduction: disbursed.totalDeduction,
      // Sheet form does not capture UTR / reference — that is only for complete disbursement.
      disbursalReferenceNo: '',
      paymentType: disbursed.paymentType || DEFAULT_DISBURSAL_PAYMENT_TYPE,
      disbursalDate: '',
      remarks: disbursed.remarks || DEFAULT_DISBURSAL_SHEET_REMARKS,
    });
    setFormError(null);
    setIsEditing(true);
  };

  const handleSubmit = async () => {
    const completingDisbursement = disbursalStage === 'sheet_sent' && !isEditing;

    if (completingDisbursement) {
      if (!canCompleteDisbursement) {
        setFormError('You do not have permission to complete disbursement.');
        return;
      }
      if (!disbursed) {
        setFormError('Disbursal sheet details are missing.');
        return;
      }
      if (!completionForm.disbursalReferenceNo.trim()) {
        setFormError('Disbursal reference number is required to complete disbursement.');
        return;
      }
      if (!completionForm.disbursalType) {
        setFormError('Disbursal type is required.');
        return;
      }

      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await createLeadDisbursal(leadId, {
          companyAccount: disbursed.companyAccount,
          accountNumber: disbursed.accountNumber,
          ifscCode: disbursed.ifscCode,
          bankName: disbursed.bankName,
          branch: disbursed.branch,
          chequeNo: disbursed.chequeNo,
          enachId: disbursed.enachId,
          fiDate: disbursed.fiDate,
          fiType: disbursed.fiType,
          fiDoneBy: disbursed.fiDoneBy,
          totalDeduction: disbursed.totalDeduction,
          disbursalReferenceNo: completionForm.disbursalReferenceNo.trim(),
          paymentType: completionForm.paymentType || disbursed.paymentType,
          disbursalType: completionForm.disbursalType,
          remarks: completionForm.remarks.trim() || disbursed.remarks,
        });
        setDisbursed(response.disbursal ? mapDisbursalFromApi(response.disbursal) : null);
        setLoanSummary(mapLoanSummaryFromApi(response.loan_summary));
        setApplicationStatus(response.application_status ?? '');
        setDisbursalStage(response.stage ?? 'none');
        setIsEditing(false);
        const statusDisplay =
          response.application_status_display ??
          (response.stage === 'disbursed' ? 'Disbursed' : 'Disbursal Sheet Send');
        toast({ title: 'Loan disbursed successfully', variant: 'success' });
        if (statusDisplay) onDisbursed?.(statusDisplay);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const isUpdatingSheet = isEditing && disbursalStage === 'sheet_sent';
    if (!isUpdatingSheet && !canSendSheet) {
      setFormError('You do not have permission to send the disbursal sheet.');
      return;
    }
    if (isUpdatingSheet && !canEdit) {
      setFormError('You do not have permission to edit disbursal details.');
      return;
    }

    if (!form.companyAccount.trim()) {
      setFormError(
        'Company account is not configured. Ask accounts/finance to set up an active company account.',
      );
      return;
    }
    if (!form.accountNumber.trim()) {
      setFormError('Beneficiary account number is required.');
      return;
    }
    if (!form.ifscCode.trim()) {
      setFormError('IFSC code is required.');
      return;
    }
    if (!form.branch.trim()) {
      setFormError('Branch is required.');
      return;
    }
    const ifscError = validateIfsc(form.ifscCode, { required: true });
    if (ifscError) {
      setFormError(ifscError);
      return;
    }
    const chequeNoError = validateChequeNo(form.chequeNo, { required: true, label: 'Cheque No.' });
    if (chequeNoError) {
      setFormError(chequeNoError);
      return;
    }
    const chequeNo = normalizeChequeNo(form.chequeNo);
    const fiDateError = validateFiDateNotAfterToday(form.fiDate, { label: 'FI date' });
    if (fiDateError) {
      setFormError(fiDateError);
      return;
    }
    const ifscCode = upperAlphanumeric(form.ifscCode, 11);
    if (!form.bankName.trim() || !form.branch.trim()) {
      setFormError(ifscLookupError ?? 'Bank details could not be resolved from IFSC. Check the IFSC code.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const response = await createLeadDisbursal(leadId, {
        companyAccount: form.companyAccount.trim(),
        accountNumber: form.accountNumber.trim(),
        ifscCode,
        bankName: form.bankName.trim(),
        branch: form.branch,
        chequeNo,
        enachId: form.enachId.trim(),
        fiDate: form.fiDate,
        fiType: form.fiType,
        fiDoneBy: form.fiDoneBy,
        totalDeduction: form.totalDeduction.trim(),
        disbursalReferenceNo: form.disbursalReferenceNo,
        paymentType: form.paymentType,
        remarks: form.remarks.trim(),
      });
      setDisbursed(response.disbursal ? mapDisbursalFromApi(response.disbursal) : null);
      setLoanSummary(mapLoanSummaryFromApi(response.loan_summary));
      setApplicationStatus(response.application_status ?? '');
      const nextStage = response.stage ?? 'none';
      setDisbursalStage(nextStage);
      setIsEditing(false);
      if (nextStage === 'sheet_sent' && response.disbursal) {
        setCompletionForm(
          buildCompletionFormFromSheet(mapDisbursalFromApi(response.disbursal)),
        );
      }
      const statusDisplay =
        response.application_status_display ??
        (response.stage === 'disbursed'
          ? 'Disbursed'
          : response.stage === 'sheet_sent'
            ? 'Disbursal Sheet Send'
            : undefined);
      toast({
        title:
          response.stage === 'disbursed'
            ? 'Loan disbursed successfully'
            : isUpdatingSheet
              ? 'Disbursal details updated'
              : 'Disbursal sheet submitted',
        variant: 'success',
      });
      if (statusDisplay) {
        onDisbursed?.(statusDisplay);
      }
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoanDisbursed =
    disbursalStage === 'disbursed' || applicationStatus === 'disbursed';
  const disbursalDetailItems = disbursed
    ? buildDisbursalDetailItems(disbursed, { isDisbursedComplete: isLoanDisbursed })
    : [];
  const loanSummaryItems = buildLoanSummaryItems(loanSummary);

  const showLoanSummary = isLoanDisbursed;
  const loanSummaryTable = showLoanSummary ? (
    <GridDetailTable
      items={loanSummaryItems}
      columnsPerRow={6}
      compact
      title="Loan Summary"
    />
  ) : null;

  const showFullForm =
    (disbursalStage === 'none' && canSendSheet)
    || (isEditing && canEdit && disbursalStage === 'sheet_sent');
  const showSheetSentView = disbursalStage === 'sheet_sent' && !isEditing;
  const showCompletionActions = canCompleteDisbursement;
  const showPendingSheetMessage =
    disbursalStage === 'none' && !canSendSheet && !isLoanDisbursed;
  const canEditDisbursalSheet = canEdit && disbursalStage === 'sheet_sent';

  return (
    <div className="space-y-5">
      {isLoading ? (
        <LoadingState layout="section" message="Loading disbursal details…" size="sm" />
      ) : showFullForm ? (
        <>
          {isEditing && (
            <p className="text-[11px] font-semibold text-primary-deep dark:text-indigo-300">
              Editing disbursal sheet
            </p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Submit disbursal details without a reference number to send the disbursal sheet first.
          </p>
          <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <FormFieldLabel required>Company Account</FormFieldLabel>
                <Input
                  value={form.companyAccount || companyAccountProfile?.account_number || ''}
                  readOnly
                  className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
                  placeholder="No active company account configured"
                />
                {companyAccountProfile && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {companyAccountProfile.account_name} — {companyAccountProfile.ifsc_code},{' '}
                    {companyAccountProfile.bank_name}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>Beneficiary Account No.</FormFieldLabel>
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>IFSC Code</FormFieldLabel>
                <Input
                  value={form.ifscCode}
                  onChange={(e) => handleIfscChange(e.target.value)}
                  className="h-8 text-[11px] uppercase"
                  maxLength={11}
                  placeholder={enterPlaceholder('IFSC Code')}
                />
                {ifscLookupError && (
                  <p className="text-[10px] text-rose-500 font-medium">{ifscLookupError}</p>
                )}
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Beneficiary Bank Name</FormFieldLabel>
                <Input
                  value={form.bankName}
                  readOnly
                  className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
                  placeholder={isIfscLookingUp ? 'Fetching bank name…' : enterPlaceholder('Auto-filled from IFSC')}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>Branch</FormFieldLabel>
                <Input
                  value={form.branch}
                  readOnly
                  className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
                  placeholder={isIfscLookingUp ? 'Fetching branch…' : enterPlaceholder('Auto-filled from IFSC')}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>Cheque No.</FormFieldLabel>
                <Input
                  value={form.chequeNo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, chequeNo: normalizeChequeNo(e.target.value) }))
                  }
                  className="h-8 text-[11px]"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder={enterPlaceholder('6-digit cheque number')}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Enach ID</FormFieldLabel>
                <Input
                  value={form.enachId}
                  onChange={(e) => setForm((prev) => ({ ...prev, enachId: e.target.value }))}
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>FI Date</FormFieldLabel>
                <DatePicker
                  value={form.fiDate}
                  onChange={(fiDate) => setForm((prev) => ({ ...prev, fiDate }))}
                  placeholder={selectPlaceholder('FI Date')}
                  size="sm"
                  maxDate={getToday()}
                  toYear={new Date().getFullYear()}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>FI Type</FormFieldLabel>
                <FormSelect
                  value={form.fiType}
                  onChange={(fiType) => setForm((prev) => ({ ...prev, fiType }))}
                  placeholder={selectPlaceholder('FI Type')}
                  options={FI_TYPE_OPTIONS}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>FI Done By</FormFieldLabel>
                <FormSelect
                  value={form.fiDoneBy}
                  onChange={(fiDoneBy) => setForm((prev) => ({ ...prev, fiDoneBy }))}
                  placeholder={selectPlaceholder('FI Done By')}
                  options={fiDoneByOptions}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Amount to be Disbursed</FormFieldLabel>
                <Input
                  type="text"
                  value={form.amountToBeDisbursed}
                  readOnly
                  className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
                  placeholder={enterPlaceholder('Auto-calculated')}
                />
                {netDisbursal && (
                  <p className="text-[10px] text-slate-400 font-medium">
                    Principal {netDisbursal.principal_amount} − PF {netDisbursal.processing_fee} − GST{' '}
                    {netDisbursal.gst}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Total Deduction</FormFieldLabel>
                <Input
                  type="text"
                  value={form.totalDeduction}
                  readOnly
                  className="h-8 text-[11px] bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
                  placeholder={enterPlaceholder('Auto-calculated (PF + GST)')}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Payment Type</FormFieldLabel>
                <FormSelect
                  value={form.paymentType}
                  onChange={(paymentType) => setForm((prev) => ({ ...prev, paymentType }))}
                  placeholder={selectPlaceholder('Payment Type')}
                  options={PAYMENT_TYPE_OPTIONS}
                />
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
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
                disabled={isSubmitting || isIfscLookingUp}
              >
                {isEditing ? 'Update Disbursal Sheet' : 'Send Disbursal Sheet'}
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
        </>
      ) : showSheetSentView ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-4 space-y-4">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Disbursal sheet sent. Complete disbursement below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <FormFieldLabel required>Disbursal Reference No.</FormFieldLabel>
                <div className="flex">
                  <Input
                    value={completionForm.disbursalReferenceNo}
                    onChange={(e) =>
                      setCompletionForm((prev) => ({
                        ...prev,
                        disbursalReferenceNo: e.target.value,
                      }))
                    }
                    className="h-8 flex-1 min-w-0 rounded-r-none border-r-0 text-[11px] focus-visible:z-10"
                    placeholder={enterPlaceholder('Disbursal Reference Number')}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 shrink-0 rounded-l-none px-2.5"
                    onClick={handleRefreshReference}
                    title="Generate reference number"
                  >
                    <RefreshCw size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <FormFieldLabel required>Disbursal Type</FormFieldLabel>
                <FormSelect
                  value={completionForm.disbursalType}
                  onChange={(disbursalType) =>
                    setCompletionForm((prev) => ({ ...prev, disbursalType }))
                  }
                  placeholder={selectPlaceholder('Disbursal Type')}
                  options={DISBURSAL_TYPE_OPTIONS}
                />
              </div>
              <div className="space-y-1">
                <FormFieldLabel>Payment Type</FormFieldLabel>
                <FormSelect
                  value={completionForm.paymentType}
                  onChange={(paymentType) =>
                    setCompletionForm((prev) => ({ ...prev, paymentType }))
                  }
                  placeholder={selectPlaceholder('Payment Type')}
                  options={PAYMENT_TYPE_OPTIONS}
                />
              </div>
            </div>
            <div className="space-y-1">
              <FormFieldLabel>Remarks</FormFieldLabel>
              <textarea
                value={completionForm.remarks}
                onChange={(e) =>
                  setCompletionForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                className={textareaClassName}
                placeholder={enterPlaceholder('Disbursement Remarks')}
              />
            </div>
            {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}
            {showCompletionActions && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg px-4"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                Complete Disbursement
              </Button>
            </div>
            )}
          </div>

          <GridDetailTable
            items={disbursalDetailItems}
            columnsPerRow={6}
            compact
            title="Disbursal Details"
            headerAction={
              canEditDisbursalSheet ? (
                <SectionEditButton onClick={handleEdit} title="Edit disbursal details" />
              ) : undefined
            }
          />
        </div>
      ) : showPendingSheetMessage ? (
        <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Disbursal sheet has not been sent yet. A credit manager must send the disbursal sheet before
            accounts &amp; finance can complete disbursement.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <GridDetailTable
            items={disbursalDetailItems}
            columnsPerRow={6}
            compact
            title="Disbursal Details"
          />
          {loanSummaryTable}
        </div>
      )}
    </div>
  );
}
