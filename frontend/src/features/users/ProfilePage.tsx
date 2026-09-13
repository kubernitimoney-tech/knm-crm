import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTitle } from '@/hooks/useTitle';
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Clock,
  Key,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatRoleNames } from '@/constants/roles';
import { badgeClass, userStatusBadgeClass } from '@/lib/badgeStyles';
import { formatAppDateTime, formatAppDateTimeOrFallback } from '@/lib/dateUtils';

function userInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatPermissionLabel(code: string): string {
  const [module, action] = code.split('.');
  if (!action) return code;
  return `${module} · ${action.replace(/_/g, ' ')}`;
}

export const ProfilePage = () => {
  useTitle('My Profile');
  const navigate = useNavigate();
  const { user, roles, permissions, access, fetchMe } = useAuthStore();
  const {
    primaryRoleName,
    isSuperAdmin,
    isAdmin,
    hasPermission,
  } = usePermissions();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchMe();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [fetchMe]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const status = user?.is_active === false ? 'Inactive' : 'Active';
  const canOpenEmployeeRecord = Boolean(user?.id && hasPermission('user.view'));

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const code of permissions) {
      const module = code.split('.')[0] || 'other';
      const existing = groups.get(module) ?? [];
      existing.push(code);
      groups.set(module, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const accessItems = useMemo(() => {
    if (!access) return [];
    const items: { label: string; enabled: boolean }[] = [
      { label: 'Edit records', enabled: access.can_edit },
      { label: 'Delete records', enabled: access.can_delete },
      { label: 'Create users', enabled: access.can_create_user },
      { label: 'Assign roles', enabled: access.can_assign_roles },
      { label: 'Grant permissions', enabled: access.can_grant_permission },
    ];
    if (isSuperAdmin) {
      items.unshift({ label: 'Super Admin', enabled: true });
    } else if (isAdmin) {
      items.unshift({ label: 'Admin', enabled: true });
    }
    return items;
  }, [access, isAdmin, isSuperAdmin]);

  if (isLoading && !user) {
    return <LoadingState layout="page" message="Loading your profile…" />;
  }

  if (loadError && !user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-rose-600 dark:text-rose-400 font-bold">{loadError}</p>
        <Button className="mt-4" onClick={() => void refreshProfile()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = userInitials(user.full_name || user.email);
  const joinedDate = formatAppDateTimeOrFallback(user.created_at, '—');
  const lastLogin = user.last_login
    ? formatAppDateTime(user.last_login)
    : 'Never';

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <Breadcrumbs />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-primary-deep dark:text-slate-100">
            My Profile
          </h1>
          <p className="text-xs text-mid-shade dark:text-slate-400 mt-1">
            Account details and access for {user.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenEmployeeRecord ? (
            <Button
              variant="outline"
              className="h-10 text-xs font-bold gap-2 rounded-xl border-slate-200 dark:border-white/10"
              onClick={() => navigate(`/master/users/${user.id}`)}
            >
              <ExternalLink size={14} />
              Employee record
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-10 text-xs font-bold gap-2 rounded-xl border-slate-200 dark:border-white/10"
            onClick={() => setIsPasswordDialogOpen(true)}
          >
            <Key size={14} />
            Change password
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="text-center py-8 px-6">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-full bg-primary-deep/10 dark:bg-white/10 flex items-center justify-center text-primary-deep dark:text-slate-100 text-3xl font-bold shadow-lg ring-4 ring-slate-50 dark:ring-white/10 mx-auto">
                {initials}
              </div>
              {user.is_verified ? (
                <div
                  className="absolute bottom-0 right-0 p-1.5 bg-emerald-500 border-2 border-white dark:border-[#32355a] rounded-full text-white"
                  title="Verified account"
                >
                  <BadgeCheck size={14} />
                </div>
              ) : null}
            </div>
            <h2 className="text-lg font-bold text-secondary-dark dark:text-slate-100">
              {user.full_name || user.email}
            </h2>
            <p className="text-xs text-mid-shade dark:text-slate-400 mb-4">
              {primaryRoleName}
            </p>
            <Badge className={userStatusBadgeClass(status, 'px-4')}>{status}</Badge>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/10 grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Joined
                </p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {joinedDate}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Employee code
                </p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate" title={user.employee_code || undefined}>
                  {user.employee_code || '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card title="Account access">
            <div className="p-6 space-y-3">
              {accessItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield
                      size={14}
                      className={item.enabled ? 'text-emerald-500 shrink-0' : 'text-slate-300 dark:text-slate-600 shrink-0'}
                    />
                    <span className="text-xs font-semibold text-secondary-dark dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={
                      item.enabled
                        ? 'text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0'
                        : 'text-[10px] text-slate-400 font-bold shrink-0'
                    }
                  >
                    {item.enabled ? 'YES' : 'NO'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
                <span className="text-xs font-semibold text-secondary-dark dark:text-slate-200">
                  Email verified
                </span>
                <span
                  className={
                    user.is_verified
                      ? 'text-[10px] text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-[10px] text-amber-600 dark:text-amber-400 font-bold'
                  }
                >
                  {user.is_verified ? 'YES' : 'PENDING'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title="Personal information">
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Full name
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary-dark dark:text-slate-200 font-medium">
                  <User size={14} className="text-mid-shade shrink-0" />
                  {user.full_name || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Email address
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary-dark dark:text-slate-200 font-medium break-all">
                  <Mail size={14} className="text-mid-shade shrink-0" />
                  {user.email}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Mobile number
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary-dark dark:text-slate-200 font-medium">
                  <Phone size={14} className="text-mid-shade shrink-0" />
                  {user.mobile_number || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Last login
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary-dark dark:text-slate-200 font-medium">
                  <Clock size={14} className="text-mid-shade shrink-0" />
                  {lastLogin}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Member since
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary-dark dark:text-slate-200 font-medium">
                  <Calendar size={14} className="text-mid-shade shrink-0" />
                  {joinedDate}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Assigned roles">
            <div className="p-6">
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Badge key={role.slug} variant="primary" className="text-[10px]">
                      {role.display_name?.trim() || role.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isSuperAdmin ? 'Super Admin (all roles)' : 'No roles assigned'}
                </p>
              )}
              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                {roles.length > 0
                  ? formatRoleNames(roles)
                  : isSuperAdmin
                    ? 'Full platform access as Super Admin'
                    : 'No organizational roles assigned'}
              </p>
            </div>
          </Card>

          <Card
            title="Permissions"
            subtitle={`${permissions.length} permission${permissions.length === 1 ? '' : 's'} from your roles and direct grants`}
          >
            <div className="p-6 space-y-5">
              {permissions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isSuperAdmin
                    ? 'Super Admin has unrestricted access.'
                    : 'No explicit permissions assigned.'}
                </p>
              ) : (
                groupedPermissions.map(([module, codes]) => (
                  <div key={module}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                      {module}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {codes.map((code) => (
                        <span
                          key={code}
                          className={badgeClass('info', 'text-[9px] normal-case tracking-normal')}
                          title={code}
                        >
                          {formatPermissionLabel(code)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
    </div>
  );
};
