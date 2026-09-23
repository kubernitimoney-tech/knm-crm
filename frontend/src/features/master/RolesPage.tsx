import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, Users } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  dataTablePrimaryActionButtonClass,
} from '@/components/ui/data-table';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import { fetchRoleDirectory, type RoleDirectoryItem } from '@/lib/permissionsApi';
import { cn } from '@/lib/utils';
import { RoleFormDialog } from './components/RoleFormDialog';

export const RolesPage = () => {
  useTitle('Roles');
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('role.create');

  const [roles, setRoles] = useState<RoleDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchRoleDirectory();
      setRoles(data.roles);
    } catch (error) {
      toast({
        title: 'Failed to load roles',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-bold tracking-tight text-slate-950">Roles</h1>
          <p className="text-sm font-medium text-slate-500">
            System roles, how many users hold them, and how many permissions each includes. Use the
            matrix to change role permissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs font-bold"
            onClick={() => navigate('/master/permission-matrix')}
          >
            Open permission matrix
          </Button>
          {canCreate && (
            <Button
              type="button"
              size="sm"
              className={dataTablePrimaryActionButtonClass}
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Role
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState layout="section" message="Loading roles…" className="py-16" />
        ) : (
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow>
                <TableHead className={dataTableHeadClass}>Role</TableHead>
                <TableHead className={dataTableHeadClass}>Slug</TableHead>
                <TableHead className={dataTableHeadClass}>Description</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Permissions</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-right')}>Users</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'text-center')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-400">
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className={dataTableCellClass}>
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        {role.display_name || role.name}
                        {role.is_locked && (
                          <Lock size={12} className="text-amber-500" aria-label="Locked role" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'font-mono text-[11px]')}>
                      {role.slug}
                    </TableCell>
                    <TableCell
                      className={cn(dataTableCellClass, 'max-w-sm truncate text-slate-500')}
                      title={role.description}
                    >
                      {role.description || '—'}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right tabular-nums')}>
                      {role.permission_count}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-right')}>
                      <Badge className="bg-slate-100 text-[10px] font-bold text-slate-600">
                        <Users size={10} className="mr-1" />
                        {role.user_count}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'text-center')}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] font-bold"
                        onClick={() =>
                          navigate(
                            `/master/permissions/assignments?role=${encodeURIComponent(role.slug)}`,
                          )
                        }
                      >
                        View assignees
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <RoleFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void load()}
      />
    </div>
  );
};
