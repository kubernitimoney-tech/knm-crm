import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import {
  fetchRoleAssignees,
  fetchRoleDirectory,
  type RoleAssignee,
  type RoleDirectoryItem,
} from '@/lib/permissionsApi';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export const RoleAssignmentsPage = () => {
  useTitle('Role Assignment');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get('role') || '';

  const [roles, setRoles] = useState<RoleDirectoryItem[]>([]);
  const [selectedRole, setSelectedRole] = useState(roleParam);
  const [assignees, setAssignees] = useState<RoleAssignee[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingRoles(true);
      try {
        const data = await fetchRoleDirectory();
        if (cancelled) return;
        setRoles(data.roles);
        if (!selectedRole && data.roles[0]) {
          setSelectedRole(data.roles[0].slug);
        }
      } catch (error) {
        toast({
          title: 'Failed to load roles',
          description: getApiErrorMessage(error),
          variant: 'error',
        });
      } finally {
        if (!cancelled) setIsLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (roleParam && roleParam !== selectedRole) {
      setSelectedRole(roleParam);
    }
  }, [roleParam]);

  const loadAssignees = useCallback(async (slug: string) => {
    if (!slug) return;
    setIsLoadingUsers(true);
    try {
      const data = await fetchRoleAssignees(slug);
      setAssignees(data.users);
    } catch (error) {
      toast({
        title: 'Failed to load assignees',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
      setAssignees([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRole) {
      void loadAssignees(selectedRole);
      setSearchParams(selectedRole ? { role: selectedRole } : {}, { replace: true });
    }
  }, [selectedRole, loadAssignees, setSearchParams]);

  const selectedMeta = roles.find((r) => r.slug === selectedRole);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-bold tracking-tight text-slate-950">Role Assignment</h1>
          <p className="text-sm font-medium text-slate-500">
            Directory of users per role. Assign or change roles from the user profile with approval
            evidence.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 text-xs font-bold"
          onClick={() => navigate('/master/users')}
        >
          Open users
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-150 bg-white p-4 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Select
            value={selectedRole}
            onValueChange={setSelectedRole}
            disabled={isLoadingRoles}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={selectPlaceholder('Role')} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.slug} value={role.slug}>
                  {role.display_name || role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedMeta && (
          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
            <Badge className="bg-slate-100 text-slate-600">
              {selectedMeta.user_count} assigned
            </Badge>
            <Badge className="bg-slate-100 text-slate-600">
              {selectedMeta.permission_count} permissions
            </Badge>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm">
        {isLoadingUsers || isLoadingRoles ? (
          <LoadingState layout="section" message="Loading assignees…" className="py-16" />
        ) : (
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow>
                <TableHead className={dataTableHeadClass}>Employee</TableHead>
                <TableHead className={dataTableHeadClass}>Email</TableHead>
                <TableHead className={dataTableHeadClass}>Code</TableHead>
                <TableHead className={dataTableHeadClass}>Assigned</TableHead>
                <TableHead className={dataTableHeadClass}>By</TableHead>
                <TableHead className={dataTableHeadClass}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-400">
                    No users assigned to this role.
                  </TableCell>
                </TableRow>
              ) : (
                assignees.map((user) => (
                  <TableRow
                    key={user.user_id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/master/users/${user.user_id}`)}
                  >
                    <TableCell className={cn(dataTableCellClass, 'font-semibold text-primary-deep')}>
                      {user.full_name}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{user.email}</TableCell>
                    <TableCell className={cn(dataTableCellClass, 'font-mono text-[11px]')}>
                      {user.employee_code || '—'}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {formatAppDateTimeOrFallback(user.assigned_at)}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {user.assigned_by_name || '—'}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      <Badge
                        className={
                          user.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
