import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProfilePage } from '../features/users/ProfilePage';
import { UsersPage } from '../features/users/UsersPage';
import { UserDetailsPage } from '../features/users/UserDetailsPage';
import { MasterCategoryPage } from '../features/master/MasterCategoryPage';
import { OptionalModulePage } from '../features/master/OptionalModulePage';
import { BranchTargetPage } from '../features/master/BranchTargetPage';
import { BankHolidaysPage } from '../features/master/BankHolidaysPage';
import { SanctionTargetPage } from '../features/master/SanctionTargetPage';
import { ApprovalMatrixPage } from '../features/master/ApprovalMatrixPage';
import { PermissionMatrixPage } from '../features/master/PermissionMatrixPage';
import { PermissionsHubPage } from '../features/master/PermissionsHubPage';
import { PermissionCatalogPage } from '../features/master/PermissionCatalogPage';
import { RolesPage } from '../features/master/RolesPage';
import { RoleAssignmentsPage } from '../features/master/RoleAssignmentsPage';
import { UserPermissionOverridesPage } from '../features/master/UserPermissionOverridesPage';
import { CustomerDetailsPage } from '../features/customers/CustomerDetailsPage';
import { LeadsPage } from '../features/leads/LeadsPage';
import { StatusWiseLeadsPage } from '../features/leads/StatusWiseLeadsPage';
import { LeadDetailsPage } from '../features/leads/LeadDetailsPage';
import { LeadDocumentViewPage } from '../features/leads/LeadDocumentViewPage';
import { SanctionsPage } from '../features/sanctions/SanctionsPage';
import { PendingSanctionsPage } from '../features/sanctions/PendingSanctionsPage';
import { RejectedSanctionsPage } from '../features/sanctions/RejectedSanctionsPage';
import { EnachSanctionsPage } from '../features/sanctions/EnachSanctionsPage';
import { DisbursalSheetPage } from '../features/disbursal/DisbursalSheetPage';
import { DisbursedLoansPage } from '../features/disbursal/DisbursedLoansPage';
import { CashPendingPage } from '../features/collections/CashPendingPage';
import { PartPaymentPage } from '../features/collections/PartPaymentPage';
import { ClosedAccountsPage } from '../features/collections/ClosedAccountsPage';
import { SettlementPage } from '../features/collections/SettlementPage';
import { RedFlagPage } from '../features/customers/RedFlagPage';
import { CibilReportPage } from '../features/reports/CibilReportPage';
import { AllReportingPage } from '../features/reports/AllReportingPage';
import { ActivityLogsReportPage } from '../features/reports/ActivityLogsReportPage';
import { RMListPage } from '../features/assignments/RMListPage';
import { CMListPage } from '../features/assignments/CMListPage';
import { ESignPage } from '../features/kyc/ESignPage';
import { PublicEsignPage } from '../features/kyc/PublicEsignPage';
import { PublicVideoKycPage } from '../features/kyc/PublicVideoKycPage';
import { VideoKycDetailPage } from '../features/kyc/VideoKycDetailPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RecoverPasswordPage } from '../features/auth/RecoverPasswordPage';
import { PlaceholderPage } from '../components/common/PlaceholderPage';
import { GuestGuard } from '../components/auth/GuestGuard';
import { NotFoundPage } from '../features/errors/NotFoundPage';
import { RouteErrorBoundary } from '../features/errors/RouteErrorBoundary';

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/recover-password',
    element: (
      <GuestGuard>
        <RecoverPasswordPage />
      </GuestGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/sign/:esignId',
    element: <PublicEsignPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/verify-kyc/:requestId',
    element: <PublicVideoKycPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <DashboardLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      { path: 'profile', element: <ProfilePage /> },
      // Leads
      { path: 'leads/status', element: <StatusWiseLeadsPage /> },
      { path: 'leads/all', element: <LeadsPage /> },
      { path: 'leads/all/:leadId/video-kyc/:requestId', element: <VideoKycDetailPage /> },
      { path: 'leads/all/:leadId/documents/:documentId/view', element: <LeadDocumentViewPage /> },
      { path: 'leads/all/:id', element: <LeadDetailsPage /> },
      { path: 'customers/:id', element: <CustomerDetailsPage /> },
      // Sanctions
      { path: 'sanctions/approved', element: <SanctionsPage /> },
      { path: 'sanctions/pending', element: <PendingSanctionsPage /> },
      { path: 'sanctions/rejected', element: <RejectedSanctionsPage /> },
      { path: 'sanctions/enach', element: <EnachSanctionsPage /> },
      // Disbursal
      { path: 'disbursal/sheet', element: <DisbursalSheetPage /> },
      { path: 'disbursal/completed', element: <DisbursedLoansPage /> },
      // Collection
      { path: 'collection/pending', element: <CashPendingPage /> },
      { path: 'collection/partial', element: <PartPaymentPage /> },
      { path: 'collection/closed', element: <ClosedAccountsPage /> },
      { path: 'collection/settlement', element: <SettlementPage /> },
      // Red Flag
      { path: 'red-flag', element: <RedFlagPage /> },
      // Reporting
      { path: 'reports/cibil', element: <CibilReportPage /> },
      { path: 'reports/all', element: <AllReportingPage /> },
      { path: 'reports/activity-logs', element: <ActivityLogsReportPage /> },
      // Lead Assignment
      { path: 'assignments/rm', element: <RMListPage /> },
      { path: 'assignments/cm', element: <CMListPage /> },
      { path: 'assignments/matrix', element: <PlaceholderPage title="Matrix Loan Approval" /> },
      // KYC
      { path: 'kyc/esign', element: <ESignPage /> },
      { path: 'kyc/video', element: <PlaceholderPage title="Video KYC" /> },
      // Marketing
      { path: 'marketing/branch', element: <PlaceholderPage title="Branch-Wise Marketing Reports" /> },
      { path: 'marketing/utm', element: <PlaceholderPage title="UTM-Wise Marketing Reports" /> },
      // Master
      { path: 'master/users', element: <UsersPage /> },
      { path: 'master/users/:id', element: <UserDetailsPage /> },
      { path: 'master/category', element: <MasterCategoryPage /> },
      { path: 'master/category/optional-module', element: <OptionalModulePage /> },
      { path: 'master/category/branch-target', element: <BranchTargetPage /> },
      { path: 'master/category/bank-holidays', element: <BankHolidaysPage /> },
      { path: 'master/category/sanction-target', element: <SanctionTargetPage /> },
      { path: 'master/category/approval-matrix', element: <ApprovalMatrixPage /> },
      { path: 'master/permissions', element: <PermissionsHubPage /> },
      { path: 'master/permissions/catalog', element: <PermissionCatalogPage /> },
      { path: 'master/permissions/roles', element: <RolesPage /> },
      { path: 'master/permissions/assignments', element: <RoleAssignmentsPage /> },
      { path: 'master/permissions/overrides', element: <UserPermissionOverridesPage /> },
      { path: 'master/permission-matrix', element: <PermissionMatrixPage /> },
      { path: 'master/category/permission-matrix', element: <PermissionMatrixPage /> },

      // Fallback — unknown routes render a 404 inside the app shell
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
