import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EDIT_SOLID_ICON_BUTTON_CLASS } from '@/lib/uiTokens';
import { cn } from '@/lib/utils';
import { CollectionTab } from './components/CollectionTab';
import { CustomerProfileSummaryCard } from './components/CustomerProfileSummaryCard';
import { LoanApplyDetailsCard } from './components/LoanApplyDetailsCard';
import { CustomerTimelineCard } from './components/CustomerTimelineCard';
import { CustomerLeadStatsBadges } from '@/features/customers/components/CustomerLeadStatsBadges';
import { computeCustomerLeadStatCounts } from '@/lib/customerLeadStatsUtils';
import { EditCustomerDialog } from './components/EditCustomerDialog';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
import { PreviousLeadsTable } from './components/PreviousLeadsTable';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchCustomerProfile,
  type CustomerProfile,
} from '@/lib/customersApi';
import { fetchLead, mapApiLeadToPreviousLeadRow } from '@/lib/leadsApi';
import {
  LEAD_DETAIL_TAB_ITEMS,
  mapProfileToViewModel,
} from '@/lib/customerProfileUtils';

export const CustomerDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusLeadId = searchParams.get('lead') ?? undefined;
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canEditCustomer = hasPermission('customer.update') || isSuperAdmin;

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('customer');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setLoadError('Customer not found');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchCustomerProfile(id, focusLeadId);
      setProfile(data);
      setResolvedCustomerId(id);
    } catch {
      try {
        const lead = await fetchLead(id);
        navigate(`/customers/${lead.customer}?lead=${lead.id}`, { replace: true });
        return;
      } catch {
        setProfile(null);
        setResolvedCustomerId(null);
        setLoadError('Customer not found');
      }
    } finally {
      setLoading(false);
    }
  }, [id, focusLeadId, navigate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const customerData = useMemo(() => {
    if (!profile || !resolvedCustomerId) {
      return mapProfileToViewModel(
        {
          customer: {
            id: '',
            customer_code: '—',
            first_name: '—',
            last_name: '',
            email: '—',
            mobile_number: '—',
            gender: '',
            dob: null,
            document_type: '',
            pan_no: '',
            aadhaar_no: '',
            occupation: '',
            monthly_income: null,
            address: '',
            created_at: '',
            updated_at: '',
          },
          leads: [],
          active_lead: null,
          call_logs: [],
          lead_stats: { applied: 0, disbursed: 0, rejected: 0, in_progress: 0 },
        },
        resolvedCustomerId ?? id ?? '',
      );
    }
    return mapProfileToViewModel(profile, resolvedCustomerId);
  }, [profile, resolvedCustomerId, id]);

  const previousLeads = useMemo(() => {
    if (!profile?.leads.length) return [];
    const excludeId = focusLeadId ?? profile.active_lead?.id;
    return profile.leads
      .filter((lead) => lead.id !== excludeId)
      .map(mapApiLeadToPreviousLeadRow);
  }, [profile, focusLeadId]);

  const renderLeadWorkflowHint = (label: string) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[14px] p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="text-xs text-slate-400 mt-2">
        {focusLeadId
          ? 'Open the selected lead to view the full workflow for this section.'
          : 'Select a lead from Previous Leads above to view workflow details.'}
      </p>
      {focusLeadId && (
        <Button
          size="sm"
          className="mt-4"
          onClick={() => navigate(`/leads/all/${focusLeadId}`)}
        >
          Open Lead Details
        </Button>
      )}
    </div>
  );

  useTitle(`Profile: ${customerData.name}`);

  const breadcrumbLabels = useMemo(() => {
    if (!resolvedCustomerId) return undefined;
    return { [resolvedCustomerId]: customerData.code };
  }, [resolvedCustomerId, customerData.code]);

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'customer':
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[14px] overflow-hidden shadow-md shadow-slate-100/50 dark:shadow-none">
            <div className="bg-primary-deep dark:bg-primary-deep/80 py-2.5 px-4 text-center text-white font-bold text-xs uppercase tracking-wider">
              Customer Profile Details
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Full Name</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.name}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Mobile No</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.mobile}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Email ID</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.email}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Adhaar Number</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.aadhaar}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">PAN Code</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono uppercase">{customerData.pan}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Gender / DOB</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.gender} / {customerData.dob}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Monthly Income</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">
                    {customerData.loanDetails.monthlyIncome}
                  </p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Current State</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.loanDetails.state}</p>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-lg bg-slate-50/25 dark:bg-slate-950/20">
                  <p className="text-slate-400 font-bold mb-1">Current City</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{customerData.loanDetails.city}</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'sanction':
        return renderLeadWorkflowHint('Sanction workflow');
      case 'penny':
        return renderLeadWorkflowHint('Penny drop verification');
      case 'disbursed':
        return renderLeadWorkflowHint('Disbursal details');
      case 'collection':
        return <CollectionTab customerId={resolvedCustomerId ?? id ?? ''} />;
      case 'recovery':
        return renderLeadWorkflowHint('Recovery approval workflow');
      case 'communication':
        return renderLeadWorkflowHint('Communication history');
      case 'refund':
        return renderLeadWorkflowHint('Refund workflow');
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <LoadingState
        layout="page"
        message="Loading customer profile…"
        className="font-sans"
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans text-slate-800 dark:text-slate-100">
      {loadError && (
        <div className="rounded-[14px] border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </div>
      )}

      {!loadError && (
        <>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs segmentLabels={breadcrumbLabels} />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Customer Details</h1>
          <p className="text-mid-shade text-xs font-medium italic">Detailed user profile information and process flows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 text-xs font-semibold rounded-md dark:border-slate-800 dark:hover:bg-slate-900"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {canEditCustomer && profile && (
            <Button
              size="sm"
              className={cn('h-9 px-4 text-xs font-semibold rounded-md', EDIT_SOLID_ICON_BUTTON_CLASS)}
              onClick={() => setEditDialogOpen(true)}
            >
              <PenLine className="w-4 h-4 mr-1" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: Profile info & Timeline (spans 4 columns) */}
        <div className="lg:col-span-4 space-y-6">

          {/* PROFILE SUMMARY CARD */}
          <CustomerProfileSummaryCard
            data={customerData}
            statusLabel={customerData.customerStatus}
          />

          {/* TIMELINE CARD */}
          <CustomerTimelineCard items={customerData.timeline} />

        </div>

        {/* RIGHT COLUMN: KPI Cards & Loan Details & Previous Table (spans 8 columns) */}
        <div className="lg:col-span-8 space-y-6">

          <CustomerLeadStatsBadges
            stats={computeCustomerLeadStatCounts(
              profile?.lead_stats ?? {
                applied: customerData.loanAppliedCount,
                disbursed: customerData.loanDisbursedCount,
                rejected: customerData.loanRejectedCount,
              },
              profile?.leads,
            )}
            leadStatus={
              customerData.leadStatus !== 'No Active Lead' ? customerData.leadStatus : undefined
            }
          />

          <LoanApplyDetailsCard
            loanDetails={customerData.loanDetails}
            customerName={customerData.name}
          />

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 tracking-tight">
              Previous Leads
            </h3>
            <PreviousLeadsTable
              leads={previousLeads}
              emptyMessage="No previous leads found for this customer"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <ResponsiveTabsNav
              items={LEAD_DETAIL_TAB_ITEMS}
              value={activeTab}
              onValueChange={setActiveTab}
            />
            {LEAD_DETAIL_TAB_ITEMS.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="mt-0 animate-in slide-in-from-bottom-2 duration-300"
              >
                {renderTabContent(tab.value)}
              </TabsContent>
            ))}
          </Tabs>

        </div>

      </div>
        </>
      )}

      <EditCustomerDialog
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={profile?.customer ?? null}
        focusLeadId={focusLeadId}
        onUpdated={(updated) => setProfile(updated)}
      />

    </div>
  );
};
