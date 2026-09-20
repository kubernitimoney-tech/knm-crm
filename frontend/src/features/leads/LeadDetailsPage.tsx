import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  MapPin,
  Clock,
  ChevronLeft,
  FileText,
  Download,
  Building2,
  Users,
  Fingerprint,
  Lock,
  MessageSquare,
  AlertCircle,
  Coins,
  FileCheck,
  XCircle,
  Send,
  Plus,
  CheckCircle,
  PhoneCall,
  Activity,
  UserCheck,
  CheckCheck,
  FileSearch,
  BookOpen,
  Receipt,
  RotateCcw,
  Sparkles,
  Search,
  User,
  ShieldAlert,
  HelpCircle,
  Undo2,
  BellRing,
  Video
} from 'lucide-react';
import { formatAppDateOrFallback, formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { badgeClass } from '@/lib/badgeStyles';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MODAL_HEADER_CLASS, SURFACE_INPUT_CLASS } from '@/lib/uiTokens';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ResponsiveTabsNav } from "@/components/ui/responsive-tabs-nav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  CALL_DISPOSITION_OPTIONS,
  CALL_DISPOSITION_TO_VALUE,
  fetchLead,
  fetchCallLogs,
  createCallLog,
  resolveLeadStatusDisplay,
  mapApiLeadToPreviousLeadRow,
  type ApiLead,
  type CallLog as ApiCallLog,
} from '@/lib/leadsApi';
import {
  fetchLeadSanction,
  fetchLeadRejection,
  fetchLeadDocuments,
  fetchLeadAddresses,
  fetchLeadDisbursal,
  fetchLeadEmployments,
  fetchLeadEsignRequests,
  sendLeadEsignRequest,
  sendLeadVideoKycRequest,
  videoKycDispatchMessage,
  type ApiLeadSanction,
  type ApiLeadEmployment,
} from '@/lib/leadDetailsApi';
import { canLogCallOnLeadTimeline, canRequestEsignAndVideoKyc } from '@/features/leads/leadEsignKycAccess';
import { emptyWorkflowReadiness, getTabAccess } from '@/lib/leadWorkflowReadiness';
import { fetchCustomerProfile, type CustomerProfile } from '@/lib/customersApi';
import {
  formatGender,
  mapProfileToViewModel,
  buildLoanDetailsFromLead,
  LEAD_DETAIL_TAB_ITEMS,
  getCustomerAvatarUrl,
  type CustomerViewModel,
} from '@/lib/customerProfileUtils';
import { CustomerProfileSummaryCard } from '@/features/customers/components/CustomerProfileSummaryCard';
import { LoanApplyDetailsCard } from '@/features/customers/components/LoanApplyDetailsCard';
import { CustomerLeadStatsBadges } from '@/features/customers/components/CustomerLeadStatsBadges';
import { computeCustomerLeadStatCounts } from '@/lib/customerLeadStatsUtils';
import { CustomerTimelineCard } from '@/features/customers/components/CustomerTimelineCard';
import { customerDetailsPath, leadListReturnToFromSearchParams, resolveLeadListBackPath } from '@/lib/leadNavigation';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { PreviousLeadsTable } from '@/features/customers/components/PreviousLeadsTable';
import { LeadDocumentDetailsSection } from '@/features/leads/components/LeadDocumentDetailsSection';
import { LeadAddressDetailsSection } from '@/features/leads/components/LeadAddressDetailsSection';
import { LeadCompanyDetailsSection } from '@/features/leads/components/LeadCompanyDetailsSection';
import { LeadReferenceDetailsSection } from '@/features/leads/components/LeadReferenceDetailsSection';
import { LeadEsignDetailsSection } from '@/features/leads/components/LeadEsignDetailsSection';
import { LeadVideoKycDetailsSection } from '@/features/leads/components/LeadVideoKycDetailsSection';
import { LeadLoanSanctionSection } from '@/features/leads/components/LeadLoanSanctionSection';
import { LeadLoanRejectionSection } from '@/features/leads/components/LeadLoanRejectionSection';
import { LeadDisbursedSection } from '@/features/leads/components/LeadDisbursedSection';
import { LeadCollectionTabContent } from '@/features/leads/components/LeadCollectionTabContent';
import { LeadWorkflowPendingBanner } from '@/features/leads/components/LeadWorkflowPendingBanner';
import { shouldHideCustomerSectionActions } from '@/features/leads/leadCustomerTabAccess';
import { CustomerRelatedLeadsEmptyState } from '@/features/leads/components/CustomerRelatedLeadsEmptyState';
import { LeadStatusHistoryDrawer } from '@/features/leads/components/LeadStatusHistoryDrawer';
import { FormFieldLabel, FormSelect } from '@/features/leads/components/leadDetailSectionShared';
import { toast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/usePermissions';

/** Application statuses where rejection is not allowed. */
const REJECTION_BLOCKED_APPLICATION_STATUSES = new Set(['disbursed', 'cancelled']);

/** Lead / application statuses that indicate sanction or later (sanction accordion content). */
const POST_SANCTION_APPLICATION_STATUSES = new Set([
  'approved',
  'disbursal_sheet_sent',
  'disbursed',
]);

const WORKFLOW_STEP_TAB: Record<string, string> = {
  Customer: 'customer',
  Sanction: 'sanction',
  'E-sign': 'customer',
  Disbursal: 'disbursed',
};

export const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadsListBackPath = useMemo(() => resolveLeadListBackPath(searchParams), [searchParams]);
  const leadsListReturnTo = useMemo(
    () => leadListReturnToFromSearchParams(searchParams) ?? { type: 'all-leads' as const },
    [searchParams],
  );
  const { canUi, hasPermission, isCollectionOfficer } = usePermissions();
  const canSanctionCreate = canUi('leadDetails', 'sanction', 'create');
  const canSanctionUpdate = canUi('leadDetails', 'sanction', 'update');
  const canDisbursalSend = canUi('leadDetails', 'disbursal', 'send');
  const canDisbursalCreate = canUi('leadDetails', 'disbursal', 'create');
  const canDisbursalEdit = canUi('leadDetails', 'disbursal', 'update');
  const canCollectionCreate = canUi('leadDetails', 'collection', 'create');
  const canCollectionUpdate = canUi('leadDetails', 'collection', 'update');
  const canCollectionEdit = canCollectionCreate || canCollectionUpdate;
  const canCollectionDelete = canUi('leadDetails', 'collection', 'delete');
  const canRemarkEdit = canUi('leadDetails', 'remark', 'update');
  const canRemarkDelete = canUi('leadDetails', 'remark', 'delete');
  const canViewDocument = canUi('leadDetails', 'document', 'view');
  const canUploadDocument = canUi('leadDetails', 'document', 'upload');
  const canReuploadDocument = canUi('leadDetails', 'document', 'reupload');
  const canDownloadDocument = canUi('leadDetails', 'document', 'download');
  const canDeleteDocument = canUi('leadDetails', 'document', 'delete');
  const canCreateAddress = canUi('leadDetails', 'address', 'create');
  const canUpdateAddress = canUi('leadDetails', 'address', 'update');
  const canDeleteAddress = canUi('leadDetails', 'address', 'delete');
  const canCreateCompany = canUi('leadDetails', 'company', 'create');
  const canUpdateCompany = canUi('leadDetails', 'company', 'update');
  const canDeleteCompany = canUi('leadDetails', 'company', 'delete');
  const canCreateReference = canUi('leadDetails', 'reference', 'create');
  const canUpdateReference = canUi('leadDetails', 'reference', 'update');
  const canDeleteReference = canUi('leadDetails', 'reference', 'delete');
  const canViewStatusHistory = canUi('leadDetails', 'statusHistory', 'view');

  // Header badge + timeline read from this; updated after calls, collections, and workflow actions.
  const [currentStatus, setCurrentStatus] = useState<string>('RM Assigned');
  const [notification, setNotification] = useState<string>('');
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState<boolean>(false);
  const [isCallFormOpen, setIsCallFormOpen] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<string>('');
  const [callRemarks, setCallRemarks] = useState<string>('');
  const [isSavingCall, setIsSavingCall] = useState<boolean>(false);

  useEscapeKey(isCallFormOpen, () => setIsCallFormOpen(false));
  useEscapeKey(isStatusHistoryOpen, () => setIsStatusHistoryOpen(false));

  const [apiLead, setApiLead] = useState<ApiLead | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [callLogs, setCallLogs] = useState<ApiCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sanctionAccordionValue, setSanctionAccordionValue] = useState('');
  const [customerAccordionValue, setCustomerAccordionValue] = useState('');
  const [workflowRefresh, setWorkflowRefresh] = useState(0);
  const [hasSanction, setHasSanction] = useState(false);
  const [hasRejection, setHasRejection] = useState(false);
  const [activeTab, setActiveTab] = useState('customer');
  const [workflowReadiness, setWorkflowReadiness] = useState(emptyWorkflowReadiness);
  const [sanctionRecord, setSanctionRecord] = useState<ApiLeadSanction | null>(null);
  const [sanctionLoading, setSanctionLoading] = useState(false);
  const pendingFreshSanctionRef = useRef<ApiLeadSanction | null>(null);
  const [leadEmployments, setLeadEmployments] = useState<ApiLeadEmployment[]>([]);
  const [esignKycRefresh, setEsignKycRefresh] = useState(0);
  const [isRequestingTimelineEsign, setIsRequestingTimelineEsign] = useState(false);
  const [isRequestingTimelineVideoKyc, setIsRequestingTimelineVideoKyc] = useState(false);

  const loadWorkflowReadiness = useCallback(async (options?: {
    freshSanction?: ApiLeadSanction | null;
    silent?: boolean;
  }) => {
    if (!id) return;
    if (!options?.silent) {
      setSanctionLoading(true);
    }
    try {
      const sanctionPromise = options?.freshSanction !== undefined
        ? Promise.resolve(options.freshSanction)
        : fetchLeadSanction(id).catch(() => null);
      const [documents, addresses, disbursal, sanction, rejection, employments, esignRequests] =
        await Promise.all([
          fetchLeadDocuments(id).catch(() => []),
          fetchLeadAddresses(id).catch(() => []),
          fetchLeadDisbursal(id).catch(() => ({
            stage: 'none',
            disbursal: null,
            loan_summary: {},
          })),
          sanctionPromise,
          fetchLeadRejection(id).catch(() => null),
          fetchLeadEmployments(id).catch(() => []),
          fetchLeadEsignRequests(id).catch(() => []),
        ]);
      const applicationStatus = apiLead?.application_status ?? '';
      const rejected = Boolean(rejection) || applicationStatus === 'rejected';
      const sanctioned =
        !rejected &&
        (Boolean(sanction) ||
          POST_SANCTION_APPLICATION_STATUSES.has(applicationStatus));
      const hasDisbursal =
        disbursal.stage === 'disbursed' || applicationStatus === 'disbursed';
      setSanctionRecord(sanction);
      setHasRejection(rejected);
      setHasSanction(sanctioned);
      setLeadEmployments(employments);
      if (rejected) {
        setSanctionAccordionValue('rejection_item');
      } else if (sanctioned) {
        setSanctionAccordionValue('sanction_item');
      }
      setWorkflowReadiness({
        hasDocuments: documents.some((doc) => Boolean(doc.file_url || doc.file_name?.trim())),
        hasAddress: addresses.some((addr) =>
          Boolean(addr.address?.trim() || addr.pincode?.trim() || addr.city?.trim()),
        ),
        hasSanction: sanctioned,
        hasEsignCompleted: esignRequests.some((row) => row.status === 'signed'),
        hasDisbursal,
      });
    } finally {
      if (!options?.silent) {
        setSanctionLoading(false);
      }
    }
  }, [id, apiLead?.status, apiLead?.application_status]);

  const handleSanctionSaved = useCallback(async (record: ApiLeadSanction) => {
    pendingFreshSanctionRef.current = record;
    setSanctionRecord(record);
    setHasSanction(true);
    setSanctionAccordionValue('sanction_item');
    setApiLead((prev) =>
      prev
        ? {
            ...prev,
            application_status: 'approved',
            application_status_display: 'Approved',
          }
        : prev,
    );
    setCurrentStatus('Approved');
    setWorkflowRefresh((n) => n + 1);
    if (!id) return;
    fetchLead(id)
      .then((lead) => {
        setApiLead(lead);
        setCurrentStatus(resolveLeadStatusDisplay(lead, 'Approved'));
      })
      .catch(() => undefined);
  }, [id]);

  const handleDisbursed = useCallback(
    async (statusDisplay: string) => {
      setCurrentStatus(statusDisplay);
      setWorkflowRefresh((n) => n + 1);
      if (!id) return;
      try {
        const lead = await fetchLead(id);
        setApiLead(lead);
        setCurrentStatus(resolveLeadStatusDisplay(lead, statusDisplay));
      } catch {
        setApiLead((prev) =>
          prev
            ? {
                ...prev,
                application_status:
                  statusDisplay === 'Disbursed'
                    ? 'disbursed'
                    : statusDisplay === 'Disbursal Sheet Send'
                      ? 'disbursal_sheet_sent'
                      : prev.application_status,
                application_status_display: statusDisplay,
              }
            : prev,
        );
      }
    },
    [id],
  );

  const handleCollectionSaved = useCallback((statusDisplay: string, status: string) => {
    setCurrentStatus(statusDisplay);
    setApiLead((prev) =>
      prev ? { ...prev, status, status_display: statusDisplay } : prev,
    );
  }, []);

  const handleDocumentApplicationStatusChange = useCallback(async () => {
    setWorkflowRefresh((n) => n + 1);
    if (!id) return;
    try {
      const lead = await fetchLead(id);
      setApiLead(lead);
      setCurrentStatus(resolveLeadStatusDisplay(lead));
    } catch {
      // Non-blocking: keep showing the last loaded lead if a background refresh fails.
    }
  }, [id]);

  const handleAddressVerificationChange = useCallback(() => {
    setWorkflowRefresh((n) => n + 1);
  }, []);

  const handleSanctionStateChange = useCallback((recorded: boolean) => {
    if (!recorded || hasRejection) return;
    setHasSanction(true);
    setSanctionAccordionValue((current) => (current === 'rejection_item' ? 'sanction_item' : current));
  }, [hasRejection]);

  const handleRejectionSaved = useCallback(async () => {
    setHasRejection(true);
    setHasSanction(false);
    setSanctionRecord(null);
    setSanctionAccordionValue('rejection_item');
    setWorkflowRefresh((n) => n + 1);
    if (!id) return;
    try {
      const lead = await fetchLead(id);
      setApiLead(lead);
      setCurrentStatus(resolveLeadStatusDisplay(lead, 'Rejected'));
    } catch {
      setCurrentStatus('Rejected');
      setApiLead((prev) =>
        prev
          ? {
              ...prev,
              status: 'not_interested',
              status_display: 'Not Interested',
              application_status: 'rejected',
              application_status_display: 'Rejected',
            }
          : prev,
      );
    }
  }, [id]);

  const showLoanSanction = !hasRejection;
  const showLoanRejection = useMemo(() => {
    if (hasRejection) return true;
    const appStatus = apiLead?.application_status ?? '';
    if (REJECTION_BLOCKED_APPLICATION_STATUSES.has(appStatus)) return false;
    if (appStatus === 'approved' || appStatus === 'disbursal_sheet_sent') return true;
    if (hasSanction) return false;
    return true;
  }, [hasRejection, hasSanction, apiLead?.application_status]);
  const isPostSanctionRejection =
    !hasRejection &&
    (apiLead?.application_status === 'approved' ||
      apiLead?.application_status === 'disbursal_sheet_sent');

  const tabAccess = useMemo(() => {
    const base = {
      sanction: getTabAccess('sanction', workflowReadiness),
      penny: getTabAccess('penny', workflowReadiness),
      disbursed: getTabAccess('disbursed', workflowReadiness),
      collection: getTabAccess('collection', workflowReadiness),
      recovery: getTabAccess('recovery', workflowReadiness),
      communication: getTabAccess('communication', workflowReadiness),
      refund: getTabAccess('refund', workflowReadiness),
    };
    const applicationStatus = apiLead?.application_status ?? '';
    const isDisbursedLead =
      applicationStatus === 'disbursed' || workflowReadiness.hasDisbursal;
    if (isCollectionOfficer && isDisbursedLead) {
      return {
        ...base,
        sanction: { allowed: true },
        disbursed: { allowed: true },
        collection: { allowed: true },
      };
    }
    return base;
  }, [workflowReadiness, isCollectionOfficer, apiLead?.application_status]);

  const handleEsignCompleted = useCallback((completed: boolean) => {
    setWorkflowReadiness((prev) =>
      prev.hasEsignCompleted === completed ? prev : { ...prev, hasEsignCompleted: completed },
    );
  }, []);

  const goToWorkflowStep = useCallback((step?: string) => {
    if (!step) return;
    const tab = WORKFLOW_STEP_TAB[step];
    if (!tab) return;
    setActiveTab(tab);
    if (step === 'E-sign') {
      setCustomerAccordionValue('esign');
    }
  }, []);

  const loadCallLogs = useCallback(() => {
    if (!id) return;
    fetchCallLogs(id)
      .then(setCallLogs)
      .catch(() => setCallLogs([]));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('Lead not found');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const lead = await fetchLead(id);
        if (cancelled) return;
        setApiLead(lead);
        setCurrentStatus(resolveLeadStatusDisplay(lead));

        const [logs, profile] = await Promise.all([
          fetchCallLogs(id).catch(() => [] as ApiCallLog[]),
          fetchCustomerProfile(lead.customer, lead.id).catch(() => null),
        ]);
        if (cancelled) return;
        setCallLogs(logs);
        setCustomerProfile(profile);
        setHasRejection(lead.application_status === 'rejected');
        setHasSanction(
          lead.application_status !== 'rejected' &&
            POST_SANCTION_APPLICATION_STATUSES.has(lead.application_status ?? ''),
        );
      } catch {
        if (cancelled) return;
        setApiLead(null);
        setCustomerProfile(null);
        setLoadError('Lead not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || loading) return;
    const freshSanction = pendingFreshSanctionRef.current;
    pendingFreshSanctionRef.current = null;
    loadWorkflowReadiness({
      freshSanction: freshSanction ?? undefined,
      silent: freshSanction != null,
    });
  }, [id, loading, workflowRefresh, esignKycRefresh, activeTab, loadWorkflowReadiness]);

  const leadTimelineItems = useMemo(
    () =>
      callLogs.map((log) => ({
        title: log.disposition_display,
        caller: log.created_by_name || 'System',
        datetime: formatAppDateTimeOrFallback(log.created_at, ''),
        body: log.remarks || '—',
      })),
    [callLogs],
  );

  const handleSaveCall = async () => {
    if (!id) return;
    if (!callStatus) {
      toast({ title: 'Please select call status', variant: 'error' });
      return;
    }
    const disposition = CALL_DISPOSITION_TO_VALUE[callStatus as keyof typeof CALL_DISPOSITION_TO_VALUE] ?? 'no_answer';
    setIsSavingCall(true);
    try {
      await createCallLog(id, { disposition, remarks: callRemarks });
      setIsCallFormOpen(false);
      setCallRemarks('');
      setCallStatus('');
      loadCallLogs();
      const updatedLead = await fetchLead(id);
      setApiLead(updatedLead);
      setCurrentStatus(
        resolveLeadStatusDisplay(updatedLead, callStatus || updatedLead.latest_call_disposition_display || '—'),
      );
      if (disposition === 'interested') {
        setWorkflowRefresh((n) => n + 1);
        toast({
          title: updatedLead.converted_application ? 'Application created' : 'Call logged',
          description: updatedLead.converted_application
            ? 'Customer marked Interested — loan application started automatically.'
            : `Disposition: ${callStatus}`,
          variant: 'success',
        });
      } else {
        toast({ title: 'Call logged', description: `Disposition: ${callStatus}`, variant: 'success' });
      }
    } catch (err) {
      toast({
        title: 'Failed to log call',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsSavingCall(false);
    }
  };

  const triggerActivity = (event: string, by: string, remarks: string, newStatus: string) => {
    setCurrentStatus(newStatus);
    setNotification(`Appended activity: "${event}" & updated active status to "${newStatus}"`);
    setTimeout(() => setNotification(''), 4500);
  };

  const customerView = useMemo(() => {
    if (!customerProfile || !apiLead) return null;
    return mapProfileToViewModel(customerProfile, apiLead.customer);
  }, [customerProfile, apiLead]);

  const leadData = useMemo(() => {
    const cv = customerView;
    const loanDetails = buildLoanDetailsFromLead(apiLead);
    const leadGender = apiLead?.customer_gender || '';
    const leadDob = apiLead?.customer_dob
      ? formatAppDateOrFallback(apiLead.customer_dob, '—')
      : '—';
    const currentEmployment =
      leadEmployments.find((row) => row.is_current) ?? leadEmployments[0] ?? null;
    const fallbackMonthlyIncome =
      currentEmployment?.monthly_salary != null ? Number(currentEmployment.monthly_salary) : 0;
    const fallbackEmploymentType =
      currentEmployment?.employment_type_display || currentEmployment?.employment_type || '—';
    return {
      id: apiLead?.id || id || '',
      customerId: apiLead?.customer || '',
      leadId: apiLead?.lead_id || '—',
      customerCode: cv?.code ?? apiLead?.customer_code ?? '—',
      name: cv?.name ?? apiLead?.customer_name ?? '—',
      email: cv?.email ?? apiLead?.email ?? '—',
      mobile: cv?.mobile ?? apiLead?.mobile_number ?? '—',
      dob: cv?.dob ?? leadDob,
      gender: cv?.gender ?? formatGender(leadGender) ?? '—',
      type: apiLead?.category_display ?? '—',
      pan: cv?.pan ?? apiLead?.pan_no ?? '—',
      aadhaar: cv?.aadhaar ?? apiLead?.aadhaar_no ?? '—',
      address: customerProfile?.customer.address ?? '—',
      avatar: getCustomerAvatarUrl(
        customerProfile?.customer.gender ?? leadGender,
      ),
      location: {
        city: loanDetails.city,
        pincode: loanDetails.pincode,
        state: loanDetails.state,
      },
      assessment: {
        loanAmount: apiLead?.required_amount ? Number(apiLead.required_amount) : 0,
        tenure: '—',
        interestRate: '—',
        monthlyIncome: apiLead?.monthly_income ? Number(apiLead.monthly_income) : fallbackMonthlyIncome,
        employmentType:
          loanDetails.employmentType && loanDetails.employmentType !== '—'
            ? loanDetails.employmentType
            : fallbackEmploymentType,
        organization: customerProfile?.customer.occupation || '—',
        source: loanDetails.source,
      },
      assignments: {
        rm: loanDetails.assignedRM,
        cm: loanDetails.assignedCM,
        verified: false,
      },
      loanDetails,
    };
  }, [id, apiLead, customerProfile, customerView, leadEmployments]);

  const profileSummaryData = useMemo((): CustomerViewModel => {
    const rawGender =
      customerProfile?.customer.gender ?? apiLead?.customer_gender ?? customerView?.gender;
    const avatar = getCustomerAvatarUrl(rawGender);
    const customerCode = customerView?.code ?? apiLead?.customer_code ?? '—';
    const customerDob =
      customerView?.dob ??
      (apiLead?.customer_dob ? formatAppDateOrFallback(apiLead.customer_dob, '—') : '—');

    if (customerView) {
      return {
        ...customerView,
        code: customerCode,
        leadId: leadData.leadId,
        dob: customerDob,
        gender: formatGender(rawGender) || customerView.gender,
        pan: customerView.pan !== '—' ? customerView.pan : leadData.pan,
        aadhaar: customerView.aadhaar !== '—' ? customerView.aadhaar : leadData.aadhaar,
        avatar,
        leadStatus: resolveLeadStatusDisplay(apiLead, currentStatus),
        loanDetails: leadData.loanDetails,
      };
    }

    return {
      id: leadData.customerId,
      leadId: leadData.leadId,
      name: leadData.name,
      code: leadData.customerCode,
      email: leadData.email,
      mobile: leadData.mobile,
      dob: leadData.dob,
      gender: formatGender(rawGender) || leadData.gender,
      pan: leadData.pan,
      aadhaar: leadData.aadhaar,
      avatar,
      loanAppliedCount: 0,
      loanDisbursedCount: 0,
      loanRejectedCount: 0,
      loanInProgressCount: 0,
      leadStatus: resolveLeadStatusDisplay(apiLead, currentStatus),
      customerStatus: 'Active',
      activeLeadUuid: leadData.id,
      loanDetails: leadData.loanDetails,
      timeline: [],
    };
  }, [
    customerView,
    customerProfile,
    apiLead,
    leadData,
    currentStatus,
  ]);

  const relatedCustomerLeads = useMemo(() => {
    if (!customerProfile?.leads.length || !id) return [];
    return customerProfile.leads
      .filter((lead) => lead.id !== id)
      .map(mapApiLeadToPreviousLeadRow);
  }, [customerProfile, id]);

  const canLogCall = canLogCallOnLeadTimeline(apiLead, hasPermission('call_log.create'));
  const canRequestEsignVideoKyc =
    hasSanction || canRequestEsignAndVideoKyc(apiLead?.application_status);
  const hideCustomerSectionActions = shouldHideCustomerSectionActions(
    apiLead?.application_status,
    apiLead?.status,
  );
  const customerCanAdd = (allowed: boolean) => allowed && !hideCustomerSectionActions;
  const customerEmailForRequests =
    leadData.email !== '—' ? leadData.email : undefined;
  const customerMobileForRequests =
    leadData.mobile !== '—' ? leadData.mobile : undefined;

  const handleTimelineEsignRequest = useCallback(async () => {
    if (!id) return;
    setIsRequestingTimelineEsign(true);
    try {
      const created = await sendLeadEsignRequest(id, 'aadhaar');
      setEsignKycRefresh((n) => n + 1);
      if (created.email_sent === false) {
        toast({
          title: 'E-sign created, email not sent',
          description:
            created.email_error
            || 'Check SMTP settings and the customer inbox or spam folder.',
          variant: 'error',
        });
      } else {
        toast({
          title: 'E-sign request sent',
          description: customerEmailForRequests
            ? `Signing request email dispatched to ${customerEmailForRequests}.`
            : 'Signing request email has been queued.',
          variant: 'success',
        });
      }
    } catch (err) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsRequestingTimelineEsign(false);
    }
  }, [id, customerEmailForRequests]);

  const handleTimelineVideoKycRequest = useCallback(async () => {
    if (!id) return;
    setIsRequestingTimelineVideoKyc(true);
    try {
      const created = await sendLeadVideoKycRequest(id);
      setEsignKycRefresh((n) => n + 1);
      const dispatched = videoKycDispatchMessage(
        created,
        customerEmailForRequests,
        customerMobileForRequests,
      );
      toast({
        title: 'Video KYC request sent',
        description: dispatched.text,
        variant: dispatched.ok ? 'success' : 'error',
      });
    } catch (err) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsRequestingTimelineVideoKyc(false);
    }
  }, [id, customerEmailForRequests, customerMobileForRequests]);

  const customerLeadStats = useMemo(
    () =>
      computeCustomerLeadStatCounts(
        {
          applied:
            customerProfile?.lead_stats.applied ??
            customerView?.loanAppliedCount ??
            0,
          disbursed:
            customerProfile?.lead_stats.disbursed ??
            customerView?.loanDisbursedCount ??
            0,
          rejected:
            customerProfile?.lead_stats.rejected ??
            customerView?.loanRejectedCount ??
            0,
          others: customerProfile?.lead_stats.others,
        },
        customerProfile?.leads,
      ),
    [customerView, customerProfile],
  );

  const leadStatusDisplay = resolveLeadStatusDisplay(apiLead, currentStatus);

  const breadcrumbLabels = useMemo(() => {
    if (!id || !leadData.leadId || leadData.leadId === '—') return undefined;
    return { [id]: leadData.leadId };
  }, [id, leadData.leadId]);

  useTitle(`Lead: ${leadData.name}`);

  if (loading) {
    return <LoadingState layout="page" message="Loading lead details…" className="font-sans" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-2 font-sans text-slate-900 dark:text-slate-100 relative">
      {loadError && (
        <div className="rounded-[14px] border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(leadsListBackPath)}>
            Back to Leads
          </Button>
        </div>
      )}

      {!loadError && (
        <>
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-slate-150 py-3 px-5 rounded-xl shadow-xl border border-slate-800 text-xs font-bold animate-in bounce-in-from-bottom duration-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <div className="relative z-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs segmentLabels={breadcrumbLabels} />
          <div className="flex flex-wrap items-center gap-3">
             <h1 className="text-[22px] font-bold text-slate-950 dark:text-slate-50 tracking-tight">
               Lead Portfolio
             </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="back-btn"
            variant="outline"
            size="sm"
            className="h-9 px-4 text-xs font-semibold rounded-md dark:border-slate-800 dark:hover:bg-slate-900"
            onClick={() => navigate(leadsListBackPath)}
          >
             <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {canViewStatusHistory ? (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-4 text-xs font-semibold rounded-md dark:border-slate-800 dark:hover:bg-slate-900"
              onClick={() => setIsStatusHistoryOpen(true)}
            >
              <Clock className="w-4 h-4 mr-1" />
              Status History
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Profile + timeline */}
        <div className="lg:col-span-3 space-y-6">
          <CustomerProfileSummaryCard
            data={profileSummaryData}
            statusLabel={customerView?.customerStatus ?? 'Active'}
            onNameClick={() => navigate(customerDetailsPath(leadData.customerId, leadData.id))}
          />

          <CustomerTimelineCard
            items={leadTimelineItems}
            onLogCall={
              canLogCall
                ? () => {
                    setCallStatus('');
                    setCallRemarks('');
                    setIsCallFormOpen(true);
                  }
                : undefined
            }
            onRequestEsign={canRequestEsignVideoKyc ? handleTimelineEsignRequest : undefined}
            onRequestVideoKyc={
              canRequestEsignVideoKyc ? handleTimelineVideoKycRequest : undefined
            }
            isRequestingEsign={isRequestingTimelineEsign}
            isRequestingVideoKyc={isRequestingTimelineVideoKyc}
          />

          {isCallFormOpen && canLogCall ? (
            <Dialog open={isCallFormOpen} onOpenChange={setIsCallFormOpen}>
              <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 sm:max-w-sm">
                <div className={MODAL_HEADER_CLASS}>
                  <DialogTitle className="text-xs font-black uppercase tracking-widest text-slate-850 dark:text-slate-100">
                    Log Call Interaction
                  </DialogTitle>
                </div>

                <div className="space-y-4.5 p-5">
                  <div className="space-y-3.5">
                    <div>
                      <FormFieldLabel required>Status</FormFieldLabel>
                      <FormSelect
                        value={callStatus}
                        onChange={setCallStatus}
                        placeholder={selectPlaceholder('Status')}
                        options={CALL_DISPOSITION_OPTIONS}
                        className={cn('h-auto min-h-[38px] w-full rounded-lg p-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary-deep', SURFACE_INPUT_CLASS)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest block mb-1">Remarks</label>
                      <textarea
                        value={callRemarks}
                        onChange={(e) => setCallRemarks(e.target.value)}
                        placeholder={enterPlaceholder('Remarks')}
                        rows={3}
                        maxLength={500}
                        className={cn('w-full resize-none rounded-lg p-2.5 text-xs leading-relaxed break-words focus:outline-none focus:ring-1 focus:ring-primary-deep', SURFACE_INPUT_CLASS)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCallFormOpen(false)}
                      className="flex-1 h-9 rounded-lg text-xs font-bold dark:border-white/12 dark:bg-[#2a2d4f] dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isSavingCall}
                      onClick={handleSaveCall}
                      className="flex-1 h-9 bg-primary-deep hover:bg-secondary-dark dark:bg-primary-deep/90 dark:hover:bg-secondary-dark/90 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
                    >
                      {isSavingCall ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}

        </div>

        {/* Related leads */}
        <div className="lg:col-span-9 space-y-6">
          {/* Replaced CustomerLeadStatsCards (loan applied / disbursed info cards) with large stat badges. */}
          <CustomerLeadStatsBadges
            stats={customerLeadStats}
            leadStatus={leadStatusDisplay}
          />

          <LoanApplyDetailsCard
            loanDetails={leadData.loanDetails}
            customerName={leadData.name}
            onCustomerNameClick={() => navigate(customerDetailsPath(leadData.customerId, leadData.id))}
          />

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 tracking-tight">
              Previous Leads
            </h3>
            {relatedCustomerLeads.length > 0 ? (
              <PreviousLeadsTable
                leads={relatedCustomerLeads}
                listReturnTo={leadsListReturnTo}
                emptyMessage="No previous leads found for this customer"
              />
            ) : (
              <CustomerRelatedLeadsEmptyState />
            )}
          </div>
        </div>
      </div>

      {/* Loan workflow tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <ResponsiveTabsNav
              items={LEAD_DETAIL_TAB_ITEMS}
              value={activeTab}
              onValueChange={setActiveTab}
            />

            {/* Customer */}
            <TabsContent value="customer" className="mt-0 animate-in slide-in-from-bottom-2 duration-300 space-y-4">
              <Accordion
                type="single"
                collapsible
                value={customerAccordionValue}
                onValueChange={setCustomerAccordionValue}
                className="space-y-4"
              >
                <AccordionItem value="docs" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800/80 flex items-center justify-center shrink-0">
                        <FileText size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Document Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadDocumentDetailsSection
                        leadId={leadData.id}
                        canAdd={customerCanAdd(canUploadDocument)}
                        canEdit={customerCanAdd(canReuploadDocument)}
                        canView={canViewDocument}
                        canDownload={canDownloadDocument}
                        canDelete={customerCanAdd(canDeleteDocument)}
                        onApplicationStatusChange={handleDocumentApplicationStatusChange}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="address" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800 flex items-center justify-center shrink-0">
                        <MapPin size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Address Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadAddressDetailsSection
                        leadId={leadData.id}
                        canAdd={customerCanAdd(canCreateAddress)}
                        canEdit={customerCanAdd(canUpdateAddress)}
                        canDelete={customerCanAdd(canDeleteAddress)}
                        onVerificationChange={handleAddressVerificationChange}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="company" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800 flex items-center justify-center shrink-0">
                        <Building2 size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Company Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadCompanyDetailsSection
                        leadId={leadData.id}
                        canAdd={customerCanAdd(canCreateCompany)}
                        canEdit={customerCanAdd(canUpdateCompany)}
                        canDelete={customerCanAdd(canDeleteCompany)}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="references" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800 flex items-center justify-center shrink-0">
                        <Users size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Reference Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadReferenceDetailsSection
                        leadId={leadData.id}
                        canAdd={customerCanAdd(canCreateReference)}
                        canEdit={customerCanAdd(canUpdateReference)}
                        canDelete={customerCanAdd(canDeleteReference)}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {canRequestEsignVideoKyc ? (
                  <>
                <AccordionItem value="esign" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800 flex items-center justify-center shrink-0">
                        <Fingerprint size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">E-sign Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadEsignDetailsSection
                        leadId={leadData.id}
                        customerEmail={customerEmailForRequests}
                        canSendRequest={customerCanAdd(canRequestEsignVideoKyc)}
                        refreshToken={esignKycRefresh}
                        onEsignCompleted={handleEsignCompleted}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="video-kyc" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-deep/5 dark:bg-slate-955 text-primary-deep dark:text-indigo-400 border border-slate-150 dark:border-slate-800 flex items-center justify-center shrink-0">
                        <Video size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Video KYC Details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    {leadData.id && (
                      <LeadVideoKycDetailsSection
                        leadId={leadData.id}
                        customerEmail={customerEmailForRequests}
                        customerMobile={customerMobileForRequests}
                        canSendRequest={customerCanAdd(canRequestEsignVideoKyc)}
                        refreshToken={esignKycRefresh}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>
                  </>
                ) : null}
              </Accordion>
            </TabsContent>

            {/* Sanction */}
            <TabsContent value="sanction" className="mt-0 animate-in slide-in-from-bottom-2 duration-300 space-y-4">
              {activeTab === 'sanction' && !tabAccess.sanction.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.sanction.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.sanction.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.sanction.previousStep)}
                />
              ) : activeTab === 'sanction' ? (
              <Accordion
                key={hasRejection ? 'rejection-only' : showLoanRejection ? 'sanction-with-rejection' : 'sanction-only'}
                type="single"
                collapsible
                value={sanctionAccordionValue}
                onValueChange={setSanctionAccordionValue}
                className="space-y-4"
              >
                {showLoanSanction && (
                <AccordionItem value="sanction_item" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center shrink-0">
                        <FileCheck size={15} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Loan Sanction</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    <LeadLoanSanctionSection
                      leadId={leadData.id}
                      applicationId={apiLead?.converted_application ?? null}
                      sanctionRecord={sanctionRecord}
                      sanctionLoading={sanctionLoading}
                      defaultEmail={leadData.email !== '—' ? leadData.email : undefined}
                      defaultAlternateMobile={leadData.mobile !== '—' ? leadData.mobile : undefined}
                      defaultMonthlyIncome={
                        leadData.assessment.monthlyIncome > 0
                          ? String(leadData.assessment.monthlyIncome)
                          : undefined
                      }
                      defaultEmploymentType={
                        leadData.assessment.employmentType !== '—'
                          ? leadData.assessment.employmentType
                          : undefined
                      }
                      defaultLoanPurpose={
                        leadData.loanDetails.loanPurpose !== '—'
                          ? leadData.loanDetails.loanPurpose
                          : undefined
                      }
                      onCancel={() => setSanctionAccordionValue('')}
                      onSaved={handleSanctionSaved}
                      onSanctionStateChange={handleSanctionStateChange}
                      canCreate={canSanctionCreate}
                      canUpdate={canSanctionUpdate}
                      canEditPricingFields={canUi('leadDetails', 'sanction', 'editPricing')}
                    />
                  </AccordionContent>
                </AccordionItem>
                )}

                {showLoanRejection && (
                  <AccordionItem value="rejection_item" className="border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 px-5 overflow-hidden shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-955 text-rose-600 dark:text-rose-400 border border-rose-150 dark:border-rose-900 flex items-center justify-center shrink-0">
                          <XCircle size={15} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Loan Rejection</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 space-y-4">
                      <LeadLoanRejectionSection
                        leadId={leadData.id}
                        enabled={activeTab === 'sanction'}
                        defaultEmail={leadData.email !== '—' ? leadData.email : undefined}
                        postSanction={isPostSanctionRejection}
                        onCancel={() => setSanctionAccordionValue('')}
                        onRejected={handleRejectionSaved}
                        canCreate={canSanctionCreate}
                        canUpdate={canSanctionUpdate}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
              ) : null}
            </TabsContent>

            {/* Bank penny drop */}
            <TabsContent value="penny" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.penny.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.penny.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.penny.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.penny.previousStep)}
                />
              ) : (
              <Card className="p-6 border border-slate-200/85 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-indigo-100 text-indigo-600">
                      <Coins size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Penny Drop Authentication</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Beneficiary Name Crosscheck</p>
                    </div>
                  </div>
                  <Badge className={badgeClass('success')}>Verified Bank Match</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bank Reference</p>
                     <p className="text-sm font-bold text-slate-850 dark:text-slate-200">HDFC Bank Ltd</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Account Number</p>
                     <p className="text-sm font-bold text-slate-850 dark:text-slate-200">XXXX XXXX 5567</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">IFSC Portal Code</p>
                     <p className="text-sm font-semibold uppercase text-slate-750 dark:text-slate-200">HDFC0001235</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Holder Registered</p>
                     <p className="text-sm font-bold text-emerald-600">AMIT SHARMA (100% Match)</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8.5 px-3.5 text-xs rounded-lg transition-all"
                    onClick={() => triggerActivity("Bank Penny Drop Verified", "System", "Deposited 1 successfully. IMPS response matched Amit Sharma.", "Penny Match")}
                  >
                    <CheckCheck size={14} className="mr-1.5" /> Initiate Penny Drop Test (1)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3.5 text-xs font-semibold rounded-lg text-slate-600"
                    onClick={() => triggerActivity("Bank Cancelled Cheque Downloaded", "RM Rahul M.", "Downloaded bank cancelled check proof from cloud storage.", "Cheque Saved")}
                  >
                    <Download size={14} className="mr-1.5 text-slate-500" /> Download Cancelled Cheque
                  </Button>
                </div>
              </Card>
              )}
            </TabsContent>

            {/* Disbursal */}
            <TabsContent value="disbursed" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.disbursed.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.disbursed.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.disbursed.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.disbursed.previousStep)}
                />
              ) : (
              <LeadDisbursedSection
                leadId={leadData.id}
                defaultBranch={sanctionRecord?.branch ?? undefined}
                defaultSalaryAccount={sanctionRecord?.salaryAccount}
                defaultLoanAmount={
                  leadData.assessment.loanAmount > 0
                    ? String(leadData.assessment.loanAmount)
                    : undefined
                }
                refreshKey={workflowRefresh}
                onDisbursed={handleDisbursed}
                canEdit={canDisbursalEdit}
                canSendSheet={canDisbursalSend}
                canCompleteDisbursement={canDisbursalCreate}
              />
              )}
            </TabsContent>

            {/* Collection */}
            <TabsContent value="collection" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.collection.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.collection.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.collection.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.collection.previousStep)}
                />
              ) : (
              leadData.id && (
                <LeadCollectionTabContent
                  leadId={leadData.id}
                  canEdit={canCollectionEdit}
                  canDelete={canCollectionDelete}
                  canRemarkEdit={canRemarkEdit}
                  canRemarkDelete={canRemarkDelete}
                  onCollectionSaved={handleCollectionSaved}
                />
              )
              )}
            </TabsContent>

            {/* Recovery approval */}
            <TabsContent value="recovery" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.recovery.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.recovery.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.recovery.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.recovery.previousStep)}
                />
              ) : (
              <Card className="p-6 border border-slate-200/85 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-slate-800 flex items-center justify-center border border-orange-100 text-orange-600">
                      <ShieldAlert size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Recovery Approval & Default pre-emption</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Loss mitigation protocols and restructuring setup</p>
                    </div>
                  </div>
                  <Badge className={badgeClass('neutral')}>Standard Risk Band</Badge>
                </div>

                <div className="p-4 rounded-xl border border-orange-100/60 bg-orange-50/10 text-xs text-orange-850 dark:text-orange-400 leading-relaxed font-semibold">
                  No early warning metrics/default history present. In case of localized customer financial crisis, run restructuring tools below.
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8.5 px-3.5 text-xs rounded-lg transition-all"
                    onClick={() => triggerActivity("Restructuring Protocol Initiated", "Admin", "Initiated emergency tenures modifications criteria mapping to 36 months.", "Restructuring Started")}
                  >
                    <Building2 size={14} className="mr-1.5" /> File Debt Restructuring
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3.5 text-xs font-semibold rounded-lg text-slate-600 border-amber-200 bg-amber-50/15"
                    onClick={() => triggerActivity("Recovery Agent Call Scheduled", "Admin", "Assigned warning callbacks tracker queue regarding DTI over-leverage.", "Call Trigger Scheduled")}
                  >
                     <PhoneCall size={13} className="mr-1.5 text-amber-600" /> Initiate Recovery Call Tracker
                  </Button>
                </div>
              </Card>
              )}
            </TabsContent>

            {/* Communication */}
            <TabsContent value="communication" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.communication.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.communication.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.communication.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.communication.previousStep)}
                />
              ) : (
              <Card className="p-6 border border-slate-200/85 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-indigo-100 text-indigo-600">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Communication Ledger</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Customer notifications & message history</p>
                    </div>
                  </div>
                  <Badge className={badgeClass('neutral')}>No Pending Alerts</Badge>
                </div>

                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/25 text-slate-500 dark:text-slate-400 text-xs italic font-medium">
                  No communication logs recorded for this lead yet.
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3.5 text-xs font-semibold rounded-lg text-slate-600 border-indigo-200 bg-indigo-50/10"
                    onClick={() => triggerActivity("Communication Notification Sent", "RM Rahul M.", "Customer communication alert dispatched via email and SMS.", "Communication Sent")}
                  >
                    <BellRing size={13} className="mr-1.5 text-indigo-500" /> Send Communication
                  </Button>
                </div>
              </Card>
              )}
            </TabsContent>

            {/* Refund */}
            <TabsContent value="refund" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
              {!tabAccess.refund.allowed ? (
                <LeadWorkflowPendingBanner
                  message={tabAccess.refund.pendingMessage ?? 'Complete the previous step first.'}
                  previousStep={tabAccess.refund.previousStep}
                  onGoToPrevious={() => goToWorkflowStep(tabAccess.refund.previousStep)}
                />
              ) : (
              <Card className="p-6 border border-slate-200/85 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-pink-50 dark:bg-slate-800 flex items-center justify-center border border-pink-100 text-pink-600">
                      <RotateCcw size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Refund Ledger</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Overpayment settlement & refund verification</p>
                    </div>
                  </div>
                  <Badge className={badgeClass('neutral')}>Zero Active Excesses</Badge>
                </div>

                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/25 text-slate-500 dark:text-slate-400 text-xs italic font-medium">
                  There are no excess payments, double EMI debits, or processing fee refunds identified for this account ledger.
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-pink-600 hover:bg-pink-750 text-white font-bold h-8.5 px-3.5 text-xs rounded-lg transition-all"
                    onClick={() => triggerActivity("Refund Voucher Formulated", "Admin", "Drafted standard excess refund voucher reference #VCH-60124 for safe-keeping.", "Refund Voucher Created")}
                  >
                    <Receipt size={14} className="mr-1.5" /> Create Refund Voucher
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3.5 text-xs font-semibold rounded-lg text-slate-600 border-pink-200 bg-pink-50/10"
                    onClick={() => triggerActivity("Refund Status Notification Sent", "RM Rahul M.", "Refund status confirmation sent to customer.", "Refund Alert Dispatched")}
                  >
                    <BellRing size={13} className="mr-1.5 text-pink-500" /> Send Refund Status Confirmation
                  </Button>
                </div>
              </Card>
              )}
            </TabsContent>
      </Tabs>

      {canViewStatusHistory && id ? (
        <LeadStatusHistoryDrawer
          leadId={id}
          leadName={leadData.name}
          open={isStatusHistoryOpen}
          onClose={() => setIsStatusHistoryOpen(false)}
        />
      ) : null}
        </>
      )}
    </div>
  );
};
