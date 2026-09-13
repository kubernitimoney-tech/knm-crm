import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useParams, useNavigate } from 'react-router-dom';
import { EDIT_SOLID_ICON_BUTTON_CLASS } from '@/lib/uiTokens';
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { usePermissions } from '@/hooks/usePermissions';
import { ResetPasswordDialog } from '@/components/users/ResetPasswordDialog';
import { useAuthStore } from '@/store/useAuthStore';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Clock,
  ChevronLeft,
  PenLine,
  BadgeCheck,
  History,
  Lock,
  MessageSquare,
  ShieldAlert,
  UserCheck,
  PlusCircle,
  Clock3,
  Paperclip
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAppDateTime, formatAppDateTimeOrFallback, parseIsoDate } from '@/lib/dateUtils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  assignUserRole,
  fetchAssignableRoles,
  fetchUser,
  fetchUserRoleHistory,
  type ApiUser,
  type AssignableRole,
  type RoleChangeRecord,
} from '@/lib/usersApi';
import { getRoleFullName } from '@/constants/roles';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { badgeClass, userStatusBadgeClass } from '@/lib/badgeStyles';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// List of organizational roles — loaded from API for assignable roles

export const UserDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAssignRoles, isSuperAdmin, canUi } = usePermissions();
  const canUpdateUser = canUi('users', 'user', 'update');
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [roleHistory, setRoleHistory] = useState<RoleChangeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [primaryRole, setPrimaryRole] = useState('');
  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const [department, setDepartment] = useState('Lending Operations');
  const [manager, setManager] = useState('—');

  // Success message feedback trigger
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tempSuccess, setTempSuccess] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Temporary roles state
  const [tempRoles, setTempRoles] = useState([
    {
      id: 'tr-1',
      roleName: 'Acting Branch Manager',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      reason: 'Priya on annual training retreat',
      status: 'Active',
      assignedBy: 'Rajesh Kumar'
    }
  ]);

  // Form states for temporary role delegator
  const [formTempRole, setFormTempRole] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');

  const loadUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const [user, history] = await Promise.all([
        fetchUser(id),
        fetchUserRoleHistory(id),
      ]);
      setApiUser(user);
      setRoleHistory(history);
      setPrimaryRole(user.roles[0]?.slug ?? '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (canAssignRoles) {
      fetchAssignableRoles()
        .then(setAssignableRoles)
        .catch(() => setAssignableRoles([]));
    }
  }, [canAssignRoles]);

  const userData = useMemo(() => {
    if (!apiUser) {
      return null;
    }
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.email,
      email: apiUser.email,
      status: apiUser.is_active ? ('Active' as const) : ('Inactive' as const),
      joinedDate: formatAppDateTime(apiUser.created_at),
      lastLogin: apiUser.last_login
        ? formatAppDateTime(apiUser.last_login)
        : 'Never',
      phone: apiUser.mobile_number || '—',
      location: '—',
      permissions: apiUser.roles.map((r) => r.name),
      modulePermissions: [],
      activities: roleHistory.slice(0, 5).map((record, idx) => ({
        id: idx + 1,
        action: record.action === 'assign' ? 'Role Assigned' : 'Role Revoked',
        target: record.role_name,
        time: formatAppDateTime(record.created_at),
        status: 'Completed',
        platform: record.performed_by_name ?? 'System',
      })),
    };
  }, [apiUser, roleHistory]);

  const breadcrumbLabels = useMemo(() => {
    if (!id || !apiUser) return undefined;
    return {
      [id]: apiUser.employee_code || apiUser.full_name || 'Employee',
    };
  }, [id, apiUser]);

  useTitle(userData ? `User: ${userData.name}` : 'User Profile');

  // Actions
  const handlePrimaryRoleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssignRoles || !id) return;

    setSaveError('');
    if (!primaryRole) {
      setSaveError('Please select a role.');
      return;
    }
    if (!approvalFile) {
      setSaveError('Approval email attachment is required for role assignment.');
      return;
    }

    try {
      await assignUserRole(id, primaryRole, approvalFile);
      setSaveSuccess(true);
      setApprovalFile(null);
      await loadUser();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to assign role');
    }
  };

  const handleCreateTempRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTempRole || !formStartDate || !formEndDate || !formReason) {
      alert("Please fill out all fields to delegate temporary permissions.");
      return;
    }

    const newDelegation = {
      id: 'tr-' + Date.now(),
      roleName: formTempRole,
      startDate: formStartDate,
      endDate: formEndDate,
      reason: formReason,
      status: 'Active',
      assignedBy: 'Administrator'
    };

    setTempRoles([newDelegation, ...tempRoles]);
    setTempSuccess(true);

    // Clear inputs
    setFormTempRole('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');

    setTimeout(() => {
      setTempSuccess(false);
    }, 4000);
  };

  const handleRevokeTempRole = (trId: string) => {
    setTempRoles(prev => prev.map(tr => tr.id === trId ? { ...tr, status: 'Revoked' } : tr));
  };

  const getStatusBadge = (status: string) => (
    <Badge className={userStatusBadgeClass(status, 'px-3 py-1')}>{status}</Badge>
  );

  if (isLoading) {
    return <LoadingState layout="page" message="Loading user details…" />;
  }

  const canResetPassword = isSuperAdmin && apiUser?.id !== currentUserId && apiUser?.is_active;

  if (loadError || !userData) {
    return (
      <div className="p-8 text-center">
        <p className="text-rose-600 font-bold">{loadError || 'User not found'}</p>
        <Button className="mt-4" onClick={() => navigate('/master/users')}>Back to Users</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <Breadcrumbs segmentLabels={breadcrumbLabels} />
          <div className="flex items-center gap-4">
             <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary-deep hover:bg-slate-100"
                onClick={() => navigate(-1)}
             >
                <ChevronLeft size={24} />
             </Button>
             <h1 className="text-[22px] font-bold text-primary-deep tracking-tight">Employee Profile</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canResetPassword ? (
            <Button
              variant="outline"
              className="h-12 text-xs font-bold gap-2 rounded-xl border-slate-200 px-6"
              onClick={() => setIsResetPasswordOpen(true)}
            >
              <Lock size={16} />
              Reset Password
            </Button>
          ) : null}
          {canUpdateUser ? (
            <Button className={cn('h-12 rounded-xl px-8 font-bold gap-2 transition-all', EDIT_SOLID_ICON_BUTTON_CLASS)}>
               <PenLine size={16} />
               Edit Profile
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Summary */}
        <div className="space-y-8">
          <Card className="text-center p-10 border-slate-100 shadow-xl shadow-slate-200/20">
            <div className="relative mx-auto mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-primary-deep/5 flex items-center justify-center text-primary-deep text-4xl font-bold shadow-inner mx-auto border-4 border-white ring-8 ring-slate-50/50">
                {userData.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="absolute bottom-1 right-1/2 translate-x-12 w-8 h-8 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center">
                 <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-primary-deep tracking-tight">{userData.name}</h2>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-[0.2em] mt-2 mb-6">
              {apiUser?.roles[0]?.name || getRoleFullName(primaryRole) || 'Unassigned'}
            </p>
            <div className="flex justify-center">
              {getStatusBadge(userData.status)}
            </div>

            <div className="mt-10 pt-10 border-t border-slate-100 grid grid-cols-2 gap-8">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Joined On</p>
                <p className="text-base font-bold text-slate-700 tracking-tight">{userData.joinedDate}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Employee code</p>
                <p className="text-base font-bold text-slate-700 tracking-tight">{apiUser?.employee_code || '—'}</p>
              </div>
            </div>
          </Card>

          <Card title="Direct Contact" className="p-8 border-slate-100">
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Mail size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Email Address</span>
                  <span className="text-sm font-semibold text-slate-700 break-all">{userData.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Phone size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Mobile Phone</span>
                  <span className="text-sm font-semibold text-slate-700">{userData.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <MapPin size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">HQ Location</span>
                  <span className="text-sm font-semibold text-slate-700">{userData.location}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Tabs & Details */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-2 h-auto w-full flex overflow-x-auto gap-1">
              <TabsTrigger value="overview" className="flex-1 min-w-[90px] uppercase tracking-widest text-[10px]">
                Overview
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex-1 min-w-[130px] uppercase tracking-widest text-[10px]">
                Roles & Delegations
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 min-w-[90px] uppercase tracking-widest text-[10px]">
                Audit Trail
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex-1 min-w-[90px] uppercase tracking-widest text-[10px]">
                Permissions
              </TabsTrigger>
              <TabsTrigger value="security" className="flex-1 min-w-[90px] uppercase tracking-widest text-[10px]">
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card title="Identity \& Organizational Assignment" className="p-8 border-slate-100">
                  <div className="space-y-8 pt-4">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">First Name</p>
                        <p className="text-base font-bold text-slate-700 tracking-tight">{userData.name.split(' ')[0]}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Last Name</p>
                        <p className="text-base font-bold text-slate-700 tracking-tight">{userData.name.split(' ')[1] || '---'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Official Department</p>
                      <p className="text-base font-bold text-slate-700 tracking-tight">{department}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Reporting Manager</p>
                      <div className="flex items-center gap-3 mt-2">
                         <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-400 border border-slate-200">SR</div>
                         <p className="text-base font-bold text-slate-700 tracking-tight">{manager}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="System Information" className="p-8 border-slate-100">
                  <div className="space-y-8 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">User Identifier</p>
                      <p className="text-base font-bold text-primary-deep tracking-tight">{userData.email.split('@')[0]}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Compliance Status</p>
                      <div className="flex items-center gap-3 mt-2">
                         <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <BadgeCheck size={16} className="text-emerald-500" />
                         </div>
                         <p className="text-sm font-bold text-slate-600">eKYC Verified (Mar 2024)</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Portal Access</p>
                      <div className="flex items-center gap-3 mt-2">
                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                            <Clock size={16} />
                         </div>
                         <p className="text-sm font-bold text-slate-600 font-mono">{userData.lastLogin}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Card title="Authorization Profile" className="p-8 border-slate-100">
                <div className="flex flex-wrap gap-3 pt-4">
                  {userData.permissions.map(perm => (
                    <Badge key={perm} variant="secondary" className="px-5 py-2 bg-slate-50 text-slate-500 border-slate-200 text-[10px] font-bold uppercase tracking-widest">
                       {perm}
                    </Badge>
                  ))}
                  <button className="text-[10px] font-bold text-primary-deep uppercase tracking-[0.2em] hover:underline ml-4" onClick={() => navigate('/master/category/permission-matrix')}>+ Manage Scopes</button>
                </div>
              </Card>
            </TabsContent>

            {/* TAB CONTENT: ROLE ASSIGNMENT & TEMP ROLE DELEGATIONS */}
            <TabsContent value="roles" className="mt-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">

              {/* PRIMARY ROLE ASSIGNMENT FORM */}
              <Card title="Primary Role Alignment Form" className="p-8 border-slate-100">
                {!canAssignRoles ? (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-500">
                    Only Super Admin and Admin can assign roles. Current role:{' '}
                    <strong>{apiUser?.roles[0]?.name ?? 'Unassigned'}</strong>
                  </div>
                ) : (
                <form onSubmit={handlePrimaryRoleSave} className="space-y-6 pt-4">
                  {saveSuccess && (
                     <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-600 animate-in zoom-in duration-300">
                       ✔ Success: Primary role assigned with approval evidence on file.
                     </div>
                  )}
                  {saveError && (
                     <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-600">
                       {saveError}
                     </div>
                  )}

                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-700 font-semibold">
                    Role assignment requires an approval email attachment (PDF, EML, MSG, PNG, JPG). Admin cannot assign Super Admin.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block" required>
                        Primary Workspace Role
                      </FieldLabel>
                      <Select value={primaryRole} onValueChange={setPrimaryRole}>
                        <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                          <SelectValue placeholder={selectPlaceholder('Role')} />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role.slug} value={role.slug}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block" required>
                        Approval Email Attachment
                      </FieldLabel>
                      <div className="relative">
                        <Paperclip className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                          type="file"
                          accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
                          onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
                          className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary-deep file:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      className="h-12 bg-primary-deep text-white rounded-xl shadow-lg shadow-primary-deep/20 px-8 font-bold text-xs gap-2 hover:opacity-95"
                    >
                      <UserCheck size={16} />
                      Update Active Role Assignment
                    </Button>
                  </div>
                </form>
                )}
              </Card>

              {/* TEMPORARY ROLE DELEGATION FORM */}
              <Card title="Temporary Role Delegation Form" className="p-8 border-slate-100">
                <form onSubmit={handleCreateTempRole} className="space-y-6 pt-4">
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3">
                    <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-rose-700 uppercase">Privilege Warning Check</p>
                      <p className="text-[11px] text-rose-600/90 font-semibold leading-relaxed">
                        Temporary role delegations grant elevated security permissions across the system. Ensure an approved delegation mandate exists in compliance tracking logs before activating.
                      </p>
                    </div>
                  </div>

                  {tempSuccess && (
                     <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-600 animate-in zoom-in duration-300">
                       ✔ Success: Temporary delegation activated! System policies updated to auto-provision workspace scope.
                     </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block" required>
                        Delegate (Temporary Role)
                      </FieldLabel>
                      <Select value={formTempRole} onValueChange={setFormTempRole}>
                        <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                          <SelectValue placeholder={selectPlaceholder('Temporary Role')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Acting Branch Manager">Acting Branch Manager (Emergency Cover)</SelectItem>
                          <SelectItem value="Temporary Auditor Support">Temporary Auditor Support (External Review)</SelectItem>
                          <SelectItem value="Senior Underwriter">Senior Underwriter (Assisting Backlogs)</SelectItem>
                          <SelectItem value="Overdue Collector Lead">Overdue Collector Lead (Month-End Recoveries)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block font-sans" required>
                        Mandate Reason / Memo
                      </FieldLabel>
                      <Input
                        placeholder={enterPlaceholder('Mandate Reason')}
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        className="h-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-primary-deep/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block" required>
                        Delegation Commences (Start Date)
                      </FieldLabel>
                      <DatePicker
                        value={formStartDate}
                        onChange={setFormStartDate}
                        placeholder={selectPlaceholder('Start Date')}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel variant="dialog" className="block" required>
                        Delegation Expires (End Date)
                      </FieldLabel>
                      <DatePicker
                        value={formEndDate}
                        onChange={setFormEndDate}
                        placeholder={selectPlaceholder('End Date')}
                        minDate={parseIsoDate(formStartDate)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      className="h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 px-8 font-bold text-xs gap-2"
                    >
                      <PlusCircle size={16} />
                      Activate Temporary Role Delegation
                    </Button>
                  </div>
                </form>
              </Card>

              {/* REGISTRY HISTORY TABLE */}
              <Card title="Active Delegation Registry File" className="p-0 overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                  <Clock3 className="text-slate-400" size={18} />
                  <div>
                    <h4 className="text-xs font-black text-primary-deep uppercase tracking-wider">Active System Delegations</h4>
                    <p className="text-[10px] text-slate-400 font-bold mb-0">List of short-term security overrides, active tokens, and expiration times</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delegated Role</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mandate Reason</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration Mandated</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned By</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        <th className="p-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tempRoles.map(tr => (
                        <tr key={tr.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 px-6">
                            <span className="font-bold text-slate-800 text-xs block">{tr.roleName}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-xs text-slate-500 font-medium italic">{tr.reason}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold text-slate-650 block">{tr.startDate} to {tr.endDate}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-[11px] font-bold text-primary-deep bg-primary-deep/5 px-2 py-0.5 rounded uppercase tracking-wider">{tr.assignedBy}</span>
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={userStatusBadgeClass(tr.status)}>
                              {tr.status}
                            </Badge>
                          </td>
                          <td className="p-4 px-6 text-right">
                            {tr.status === 'Active' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => handleRevokeTempRole(tr.id)}
                              >
                                Revoke Early
                              </Button>
                            ) : (
                              <span className="text-[10px] font-black text-slate-300 uppercase select-none tracking-widest pr-4">Revoked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </TabsContent>

            <TabsContent value="activity" className="mt-8 animate-in slide-in-from-bottom-2 duration-300">
              <Card className="p-0 border-slate-100 overflow-hidden shadow-xl shadow-slate-200/20">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="space-y-1">
                     <h3 className="text-lg font-black text-primary-deep flex items-center gap-3">
                       <History size={20} className="text-slate-400" />
                       Recent Activity Stream
                     </h3>
                     <p className="text-xs text-slate-400 font-medium italic">Tracking system interactions for the last 30 days</p>
                   </div>
                   <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl">Download PDF</Button>
                     <Button variant="ghost" size="sm" className="h-10 text-[10px] font-black uppercase tracking-widest text-primary-deep rounded-xl bg-primary-deep/5">View Full History</Button>
                   </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {userData.activities.map(log => (
                    <div key={log.id} className="px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/40 transition-all cursor-default">
                      <div className="flex items-start gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                          log.action.includes('Approved') || log.action.includes('Update') ? "bg-emerald-50 text-emerald-600" :
                          log.action.includes('Rejected') ? "bg-red-50 text-red-600" :
                          "bg-slate-100 text-slate-400"
                        )}>
                           <MessageSquare size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-bold text-slate-700 tracking-tight">{log.action}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-primary-deep bg-primary-deep/5 px-2 py-0.5 rounded-md uppercase tracking-widest">{log.target}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase">{log.platform}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4">
                        <Badge
                          className={
                            log.status === 'Completed' || log.status === 'Success'
                              ? badgeClass('success')
                              : log.status === 'Processing'
                                ? badgeClass('warning')
                                : badgeClass('neutral')
                          }
                        >
                          {log.status}
                        </Badge>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">{log.time}</span>
                      </div>
                    </div>
                  ))}
                  <div className="px-8 py-6 bg-slate-50/20 text-center">
                    <button className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] hover:text-primary-deep transition-colors">End of current results</button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="mt-8 animate-in slide-in-from-bottom-2 duration-300">
               <Card title="Module Access Permissions" className="p-8 border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {userData.permissions.length > 0 ? userData.permissions.map((perm) => (
                      <div key={perm} className="p-5 rounded-2xl border border-slate-100 bg-white">
                         <h4 className="text-sm font-bold text-slate-700">{perm}</h4>
                         <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Role-based access</p>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-400 font-medium col-span-2">No roles assigned yet.</p>
                    )}
                  </div>
                  <div className="mt-8 p-6 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Lock size={18} />
                     </div>
                     <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Restrictive Access Policy</p>
                        <p className="text-[11px] text-amber-600/80 font-medium italic">Changes to these permissions require Administrative Approval and a valid session token.</p>
                     </div>
                  </div>
               </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-8 animate-in slide-in-from-bottom-2 duration-300">
               <Card title="Security & Compliance" className="p-8 border-slate-100">
                  <div className="space-y-8 pt-4">
                    <div className="flex items-center justify-between p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-inner">
                       <div className="flex items-center gap-6">
                         <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                            <Shield size={24} />
                         </div>
                         <div className="space-y-1">
                            <p className="text-lg font-bold text-emerald-700">Account Health: Secure</p>
                            <p className="text-xs text-emerald-600/80 font-medium italic">Device: Mac Pro M2 • IP: 182.xx.xx.91</p>
                         </div>
                       </div>
                       <Badge className={badgeClass('success', 'px-4 py-1.5 rounded-xl normal-case tracking-normal')}>PROTECTED</Badge>
                    </div>

                    <div className="space-y-2">
                       <div className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-sm font-bold text-slate-700">Two-Factor Authentication</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile OTP + Authenticator App</p>
                          </div>
                          <Badge variant="success">ACTIVE</Badge>
                       </div>
                       <div className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-sm font-bold text-slate-700">Location-Based Login</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Restricted to Maharashtra, India</p>
                          </div>
                          <span className="text-xs font-bold text-slate-400 italic">No restrictions</span>
                       </div>
                       <div className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-sm font-bold text-slate-700">Last Profile Update</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modified by Admin System</p>
                          </div>
                          <span className="text-xs font-bold text-slate-500 font-mono">14 April 2024</span>
                       </div>
                    </div>

                    <div className="pt-6 space-y-3">
                      {canResetPassword ? (
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-amber-50 hover:text-amber-700 hover:border-amber-100 transition-all"
                          onClick={() => setIsResetPasswordOpen(true)}
                        >
                          <Lock size={14} className="mr-2" />
                          Reset Employee Password
                        </Button>
                      ) : null}
                      <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all">
                        Terminate All Active Sessions
                      </Button>
                    </div>
                  </div>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {apiUser && canResetPassword ? (
        <ResetPasswordDialog
          open={isResetPasswordOpen}
          onOpenChange={setIsResetPasswordOpen}
          userId={apiUser.id}
          userName={userData.name}
          userEmail={apiUser.email}
        />
      ) : null}
    </div>
  );
};
