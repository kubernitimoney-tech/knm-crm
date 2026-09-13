import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  dataTableCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
} from '@/components/ui/data-table';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import { fetchUsers, type ApiUser } from '@/lib/usersApi';
import {
  fetchPermissionCatalog,
  fetchUserPermissionInventory,
  grantUserPermission,
  revokeUserPermission,
  type MatrixPermission,
  type UserPermissionInventory,
} from '@/lib/permissionsApi';
import { usePermissions } from '@/hooks/usePermissions';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export const UserPermissionOverridesPage = () => {
  useTitle('User Permission Overrides');
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('user') || '';

  const { canGrantPermission, canGrantDeletePermission } = usePermissions();

  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<ApiUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(userIdParam);
  const [inventory, setInventory] = useState<UserPermissionInventory | null>(null);
  const [catalogCodes, setCatalogCodes] = useState<MatrixPermission[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  const [grantCode, setGrantCode] = useState('');
  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetchPermissionCatalog()
      .then((data) => {
        const codes: MatrixPermission[] = [];
        for (const mod of data.modules) {
          for (const perm of mod.permissions) {
            if (perm.status !== 'inactive') codes.push(perm);
          }
        }
        setCatalogCodes(codes);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setIsLoadingUsers(true);
      try {
        const data = await fetchUsers({
          page: 1,
          page_size: 20,
          search: userSearch || undefined,
          is_active: true,
        });
        setUserOptions(data.results);
      } catch {
        setUserOptions([]);
      } finally {
        setIsLoadingUsers(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  const loadInventory = useCallback(async (userId: string) => {
    if (!userId) {
      setInventory(null);
      return;
    }
    setIsLoadingInventory(true);
    try {
      const data = await fetchUserPermissionInventory(userId);
      setInventory(data);
    } catch (error) {
      toast({
        title: 'Failed to load user permissions',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
      setInventory(null);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (userIdParam) setSelectedUserId(userIdParam);
  }, [userIdParam]);

  useEffect(() => {
    if (selectedUserId) {
      setSearchParams({ user: selectedUserId }, { replace: true });
      void loadInventory(selectedUserId);
    }
  }, [selectedUserId, loadInventory, setSearchParams]);

  const grantableCodes = useMemo(() => {
    const held = new Set(inventory?.overrides.map((o) => o.permission_code) ?? []);
    return catalogCodes.filter((p) => {
      if (held.has(p.code)) return false;
      if (p.is_critical && !canGrantDeletePermission) return false;
      return true;
    });
  }, [catalogCodes, inventory, canGrantDeletePermission]);

  const handleGrant = async () => {
    if (!selectedUserId || !grantCode || !approvalFile) {
      toast({
        title: 'Missing fields',
        description: 'Select a user, permission, and approval email file.',
        variant: 'error',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await grantUserPermission(selectedUserId, grantCode, approvalFile);
      toast({ title: 'Override granted', variant: 'success' });
      setGrantCode('');
      setApprovalFile(null);
      await loadInventory(selectedUserId);
    } catch (error) {
      toast({
        title: 'Grant failed',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (code: string) => {
    if (!selectedUserId || !approvalFile) {
      toast({
        title: 'Approval file required',
        description: 'Attach an approval email before revoking an override.',
        variant: 'error',
      });
      return;
    }
    const perm = catalogCodes.find((p) => p.code === code);
    if (perm?.is_critical && !canGrantDeletePermission) {
      toast({
        title: 'Super Admin only',
        description: 'Only Super Admin can revoke delete permissions.',
        variant: 'error',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await revokeUserPermission(selectedUserId, code, approvalFile);
      toast({ title: 'Override revoked', variant: 'success' });
      await loadInventory(selectedUserId);
    } catch (error) {
      toast({
        title: 'Revoke failed',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-1">
        <Breadcrumbs />
        <h1 className="text-[22px] font-bold tracking-tight text-slate-950">
          User Permission Overrides
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Direct grants layered on top of role permissions. Effective access is role ∪ overrides.
          Delete permissions can only be granted by Super Admin.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-150 bg-white p-4 lg:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel>Find user</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={searchPlaceholder('name', 'email', 'employee code')}
              className="h-9 pl-9 text-xs"
            />
          </div>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue
                placeholder={isLoadingUsers ? 'Loading…' : selectPlaceholder('User')}
              />
            </SelectTrigger>
            <SelectContent>
              {userOptions.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email} ({user.employee_code || user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canGrantPermission && (
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Grant override
            </p>
            <Select value={grantCode} onValueChange={setGrantCode}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={selectPlaceholder('Permission')} />
              </SelectTrigger>
              <SelectContent>
                {grantableCodes.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <FieldLabel>Approval email</FieldLabel>
              <Input
                type="file"
                accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
                className="h-9 text-xs"
                onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              size="sm"
              className="h-8 text-xs font-bold"
              disabled={isSubmitting || !selectedUserId}
              onClick={() => void handleGrant()}
            >
              <Plus size={14} className="mr-1" />
              Grant
            </Button>
          </div>
        )}
      </div>

      {!selectedUserId ? (
        <p className="rounded-xl border border-slate-150 bg-white p-10 text-center text-sm text-slate-400">
          Select a user to inspect roles, overrides, and effective permissions.
        </p>
      ) : isLoadingInventory ? (
        <LoadingState layout="section" message="Loading inventory…" className="py-16" />
      ) : inventory ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Roles', value: inventory.roles.length },
              { label: 'From roles', value: inventory.role_permission_count },
              { label: 'Overrides', value: inventory.override_count },
              { label: 'Effective', value: inventory.effective_count },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-150 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
              Roles ({inventory.user.full_name})
            </h2>
            <div className="flex flex-wrap gap-2">
              {inventory.roles.length === 0 ? (
                <span className="text-xs text-slate-400">No roles assigned</span>
              ) : (
                inventory.roles.map((role) => (
                  <Badge key={role.slug} className="bg-indigo-50 text-indigo-700">
                    {role.display_name || role.name} · {role.permission_count} perms
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Direct overrides
              </h2>
            </div>
            <Table>
              <TableHeader className={dataTableHeaderClass}>
                <TableRow>
                  <TableHead className={dataTableHeadClass}>Code</TableHead>
                  <TableHead className={dataTableHeadClass}>Granted</TableHead>
                  <TableHead className={dataTableHeadClass}>By</TableHead>
                  <TableHead className={dataTableHeadClass}>Also in role</TableHead>
                  <TableHead className={cn(dataTableHeadClass, 'text-center')}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.overrides.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-xs text-slate-400">
                      No direct grants for this user.
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.overrides.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className={cn(dataTableCellClass, 'font-mono text-[11px]')}>
                        {row.permission_code}
                        {row.is_critical && (
                          <span className="ml-2 text-[9px] font-bold uppercase text-rose-600">
                            delete
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        {formatAppDateTimeOrFallback(row.granted_at)}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        {row.granted_by_name || '—'}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>
                        {row.also_from_role ? 'Yes' : 'No'}
                      </TableCell>
                      <TableCell className={cn(dataTableCellClass, 'text-center')}>
                        {canGrantPermission && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] font-bold text-rose-600"
                            disabled={isSubmitting}
                            onClick={() => void handleRevoke(row.permission_code)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Effective permissions
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-1.5">
                {inventory.effective_permissions.map((row) => (
                  <span
                    key={row.code}
                    title={row.sources.join(', ')}
                    className={cn(
                      'rounded-md border px-2 py-0.5 font-mono text-[10px]',
                      row.from_override && row.from_role
                        ? 'border-violet-200 bg-violet-50 text-violet-800'
                        : row.from_override
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600',
                    )}
                  >
                    {row.code}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {inventory.history.length > 0 && (
            <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                Override audit
              </h2>
              <ul className="space-y-2 text-xs text-slate-600">
                {inventory.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-2 border-b border-slate-50 pb-2">
                    <span className="font-bold uppercase text-slate-800">{h.action}</span>
                    <span className="font-mono">{h.permission_code}</span>
                    <span className="text-slate-400">
                      {formatAppDateTimeOrFallback(h.created_at)} · {h.performed_by_name || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
