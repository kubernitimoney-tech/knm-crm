import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  dataTableActionCellClass,
  dataTableCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTablePrimaryActionButtonClass,
} from '@/components/ui/data-table';
import {
  DataTableActionHead,
  DataTableListingActions,
  usePermissionActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import { userStatusBadgeClass } from '@/lib/badgeStyles';
import {
  deletePermission,
  fetchPermissionCatalog,
  type MatrixPermission,
  type PermissionCatalogData,
} from '@/lib/permissionsApi';
import { cn } from '@/lib/utils';
import { PermissionFormDialog } from './components/PermissionFormDialog';

function statusLabel(status?: string): 'Active' | 'Inactive' {
  return status === 'inactive' ? 'Inactive' : 'Active';
}

export const PermissionCatalogPage = () => {
  useTitle('Permission Catalog');
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('permission.create');

  const actionCol = usePermissionActionColumn({
    edit: 'permission.update',
    delete: 'permission.delete',
  });

  const [data, setData] = useState<PermissionCatalogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MatrixPermission | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchPermissionCatalog({
        module: moduleFilter === 'all' ? undefined : moduleFilter,
        search: search.trim() || undefined,
      });
      setData(result);
    } catch (error) {
      toast({
        title: 'Failed to load catalog',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [moduleFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => {
    const list: (MatrixPermission & { moduleName: string })[] = [];
    for (const mod of data?.modules ?? []) {
      for (const perm of mod.permissions) {
        list.push({ ...perm, moduleName: mod.name });
      }
    }
    list.sort((a, b) => a.code.localeCompare(b.code));
    return list;
  }, [data]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: MatrixPermission) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleDelete = async (row: MatrixPermission) => {
    try {
      await deletePermission(row.id);
      toast({
        title: 'Permission deleted',
        description: `${row.code} is now inactive.`,
        variant: 'success',
      });
      await load();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: getApiErrorMessage(error),
        variant: 'error',
      });
      throw error;
    }
  };

  const colSpan = 6 + (actionCol.showColumn ? 1 : 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Breadcrumbs />
          <h1 className="text-[22px] font-bold tracking-tight text-slate-950">
            Permission Catalog
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Master inventory of permission codes (
            <code className="rounded bg-slate-100 px-1 text-[11px]">module.action</code>
            ).
          </p>
        </div>
        {canCreate && (
          <Button
            type="button"
            size="sm"
            className={cn(dataTablePrimaryActionButtonClass, 'shrink-0')}
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Permission
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-150 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder('code', 'module', 'action')}
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-9 w-full sm:w-48 text-xs">
            <SelectValue placeholder={selectPlaceholder('Module')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {(data?.module_options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge className="h-8 justify-center bg-slate-100 text-[11px] font-bold text-slate-600">
          {data?.total_permissions ?? 0} permissions
        </Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState layout="section" message="Loading permission catalog…" className="py-16" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className={dataTableHeaderClass}>
                <TableRow>
                  <TableHead className={dataTableHeadClass}>Code</TableHead>
                  <TableHead className={dataTableHeadClass}>Module</TableHead>
                  <TableHead className={dataTableHeadClass}>Action</TableHead>
                  <TableHead className={dataTableHeadClass}>Status</TableHead>
                  <TableHead className={cn(dataTableHeadClass, 'text-right')}>Roles</TableHead>
                  <TableHead className={cn(dataTableHeadClass, 'text-right')}>Overrides</TableHead>
                  <DataTableActionHead visible={actionCol.showColumn} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="h-32 text-center text-xs text-slate-400">
                      No permissions match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const label = statusLabel(row.status);
                    const canDeleteRow =
                      actionCol.showDelete && row.status !== 'inactive';
                    return (
                      <TableRow key={row.id}>
                        <TableCell className={cn(dataTableCellClass, 'font-mono text-[11px]')}>
                          <div className="flex items-center gap-2">
                            {row.code}
                            {row.is_critical && (
                              <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
                                Delete
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={dataTableCellClass}>{row.moduleName}</TableCell>
                        <TableCell className={dataTableCellClass}>{row.action_label}</TableCell>
                        <TableCell className={dataTableCellClass}>
                          <Badge className={userStatusBadgeClass(label)}>{label}</Badge>
                        </TableCell>
                        <TableCell className={cn(dataTableCellClass, 'text-right tabular-nums')}>
                          {row.role_count ?? 0}
                        </TableCell>
                        <TableCell className={cn(dataTableCellClass, 'text-right tabular-nums')}>
                          {row.direct_grant_count ?? 0}
                        </TableCell>
                        {actionCol.showColumn && (
                          <TableCell className={dataTableActionCellClass}>
                            <DataTableListingActions
                              visibility={{
                                ...actionCol,
                                showDelete: canDeleteRow,
                              }}
                              onEdit={
                                actionCol.showEdit ? () => openEdit(row) : undefined
                              }
                              onDelete={
                                canDeleteRow ? () => handleDelete(row) : undefined
                              }
                              deleteTitle={`Deactivate ${row.code}?`}
                              deleteDescription="This marks the permission inactive. Role and user links are kept for audit."
                              deleteConfirmLabel="Deactivate"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PermissionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        moduleOptions={data?.module_options ?? []}
        actionOptions={data?.actions ?? []}
        statusOptions={
          data?.status_options ?? [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]
        }
        editing={editing}
        onSaved={() => void load()}
      />
    </div>
  );
};
