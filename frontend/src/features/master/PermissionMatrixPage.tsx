import React, { useCallback, useMemo, useState } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ShieldCheck,
  Lock,
  Search,
  Upload,
  FileText,
  Check,
  CircleX,
  History,
  FileCheck,
  ShieldAlert,
  RefreshCw,
  FolderLock,
  Loader2,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildMatrixState,
  fetchPermissionMatrix,
  fetchPermissionMatrixAudit,
  grantRolePermission,
  revokeRolePermission,
  type MatrixModule,
  type MatrixPermission,
  type MatrixRole,
  type PermissionAuditLog,
  type PermissionMatrixData,
} from '@/lib/permissionsApi';
import { formatPersonName, cn } from '@/lib/utils';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { MODAL_OVERLAY_CLASS, MODAL_PANEL_CLASS } from '@/lib/uiTokens';
import { searchPlaceholder } from '@/lib/placeholders';
import { AppSelect } from '@/components/ui/app-select';

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'view', label: 'View Action Only' },
  { value: 'create', label: 'Create Action Only' },
  { value: 'update', label: 'Update Action Only' },
  { value: 'approve', label: 'Approve Action Only' },
  { value: 'reject', label: 'Reject Action Only' },
  { value: 'export', label: 'Export Action Only' },
  { value: 'delete', label: 'Delete Action Only' },
  { value: 'critical', label: 'Critical Removals Only' },
];

export const PermissionMatrixPage = () => {
  useTitle('RBAC Permission Matrix');
  const navigate = useNavigate();
  const { canGrantPermission, canGrantDeletePermission, roleNamesLabel, hasPermission } =
    usePermissions();
  const canViewMatrix = hasPermission('permission.view');
  const canEditMatrix = canGrantPermission;

  const [matrixData, setMatrixData] = useState<PermissionMatrixData | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');
  const [selectedPermissionType, setSelectedPermissionType] = useState('all');
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  const [pendingChange, setPendingChange] = useState<{
    roleSlug: string;
    roleName: string;
    permissionCode: string;
    permissionName: string;
    moduleName: string;
    actionLabel: 'grant' | 'revoke';
    currentValue: boolean;
    isCritical: boolean;
  } | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEscapeKey(Boolean(pendingChange), () => {
    setPendingChange(null);
    setUploadedFile(null);
  });

  const roles = matrixData?.roles ?? [];
  const modules = matrixData?.modules ?? [];
  const totalPermissions = matrixData?.total_permissions ?? 0;

  const allPermissions = useMemo(
    () => modules.flatMap((mod) => mod.permissions),
    [modules],
  );

  const applyMatrixPayload = useCallback((payload: PermissionMatrixData) => {
    setMatrixData(payload);
    setMatrix(buildMatrixState(payload.roles));
  }, []);

  const loadMatrixData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const [matrixPayload, auditPayload] = await Promise.all([
        fetchPermissionMatrix(),
        fetchPermissionMatrixAudit(),
      ]);
      applyMatrixPayload(matrixPayload);
      setAuditLogs(auditPayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load permission matrix';
      setLoadError(message);
      toast({ title: 'Failed to load matrix', description: message, variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyMatrixPayload]);

  React.useEffect(() => {
    void loadMatrixData();
  }, [loadMatrixData]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    roles.forEach((role) => {
      counts[role.slug] = role.granted_count;
    });
    return counts;
  }, [roles]);

  const filteredPermissions = useMemo(() => {
    return allPermissions.filter((item) => {
      if (selectedModuleFilter !== 'all' && item.module !== selectedModuleFilter) {
        return false;
      }

      if (selectedPermissionType !== 'all') {
        if (selectedPermissionType === 'critical') {
          if (!item.is_critical) return false;
        } else if (item.action !== selectedPermissionType) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const moduleObj = modules.find((m) => m.module === item.module);
        return (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          (moduleObj?.name.toLowerCase().includes(query) ?? false)
        );
      }

      return true;
    });
  }, [allPermissions, modules, searchQuery, selectedModuleFilter, selectedPermissionType]);

  const groupedPermissions = useMemo(() => {
    const result: { module: MatrixModule; items: MatrixPermission[] }[] = [];
    modules.forEach((mod) => {
      const items = filteredPermissions.filter((p) => p.module === mod.module);
      if (items.length > 0) {
        result.push({ module: mod, items });
      }
    });
    return result;
  }, [modules, filteredPermissions]);

  const handleToggleCheckbox = (role: MatrixRole, permission: MatrixPermission) => {
    if (!canEditMatrix) {
      toast({
        title: 'Unauthorized',
        description: 'You do not have permission to modify role permissions.',
        variant: 'error',
      });
      return;
    }

    if (permission.is_critical && !canGrantDeletePermission) {
      toast({
        title: 'Super Admin only',
        description: 'Only Super Admin can grant or revoke delete permissions.',
        variant: 'error',
      });
      return;
    }

    if (role.is_locked) {
      toast({
        title: 'Locked role',
        description: 'Super Admin role permissions cannot be modified.',
        variant: 'error',
      });
      return;
    }

    const moduleObj = modules.find((m) => m.module === permission.module);
    const isGranted = !!matrix[role.slug]?.[permission.code];

    setPendingChange({
      roleSlug: role.slug,
      roleName: role.name,
      permissionCode: permission.code,
      permissionName: permission.name,
      moduleName: moduleObj?.name ?? permission.module,
      actionLabel: isGranted ? 'revoke' : 'grant',
      currentValue: isGranted,
      isCritical: permission.is_critical,
    });
    setUploadedFile(null);
    setFileError('');
  };

  const validateAndSetFile = (file: File) => {
    const allowedExtensions = ['pdf', 'msg', 'eml', 'png', 'jpg', 'jpeg'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExt)) {
      setFileError(`Unsupported format! Allowed: ${allowedExtensions.join(', ').toUpperCase()}`);
      setUploadedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('File must be 10MB or smaller.');
      setUploadedFile(null);
      return;
    }

    setFileError('');
    setUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleSaveChangesConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingChange || !uploadedFile) {
      setFileError('Mandatory: Please attach the signature or approval compliance email.');
      return;
    }

    setIsSaving(true);
    try {
      const payload =
        pendingChange.actionLabel === 'grant'
          ? await grantRolePermission(
              pendingChange.roleSlug,
              pendingChange.permissionCode,
              uploadedFile,
            )
          : await revokeRolePermission(
              pendingChange.roleSlug,
              pendingChange.permissionCode,
              uploadedFile,
            );

      applyMatrixPayload(payload);
      const auditPayload = await fetchPermissionMatrixAudit();
      setAuditLogs(auditPayload);

      toast({
        title:
          pendingChange.actionLabel === 'grant'
            ? 'Permission granted'
            : 'Permission revoked',
        description: `"${pendingChange.permissionName}" for ${pendingChange.roleName}.`,
        variant: 'success',
      });

      setPendingChange(null);
      setUploadedFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save permission change';
      toast({ title: 'Save failed', description: message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewMatrix) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState layout="page" message="Loading permission matrix…" />;
  }

  if (loadError && !matrixData) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-sm font-semibold text-rose-600">{loadError}</p>
        <Button onClick={() => void loadMatrixData()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <Breadcrumbs />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-primary-deep dark:hover:bg-slate-900"
              onClick={() => navigate('/master/category')}
            >
              <ChevronLeft size={24} />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-primary-deep dark:text-white">
                RBAC Permission Matrix
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-600">
                  Compliance Engaged
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Live role permissions from backend RBAC ({totalPermissions} permissions)
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-150 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Signed in as
          </span>
          <span className="rounded-xl bg-primary-deep px-3 py-1.5 text-xs font-semibold text-white">
            {roleNamesLabel}
          </span>
          {!canEditMatrix && (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Read Only
            </span>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-primary-deep p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute bottom-0 right-0 translate-y-6 opacity-10">
          <FolderLock size={200} />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert size={18} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Compliance Safeguard Active
            </span>
          </div>
          <h2 className="m-0 text-lg font-bold tracking-tight text-white">
            Mandatory Audit Validation Policy
          </h2>
          <p className="text-xs font-medium leading-normal text-slate-300">
            Changes to role permissions require an approval document upload and are recorded in the
            audit trail. Delete permissions can only be granted or revoked by Super Admin.
            Delete actions in the application perform soft deletes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {roles.map((role) => {
          const granted = roleCounts[role.slug] || 0;
          const percentage = totalPermissions ? Math.round((granted / totalPermissions) * 100) : 0;

          return (
            <div
              key={role.slug}
              onMouseEnter={() => setHoveredRole(role.slug)}
              onMouseLeave={() => setHoveredRole(null)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                hoveredRole === role.slug
                  ? 'scale-[1.02] border-primary-deep bg-slate-50/50 shadow-lg dark:bg-slate-900/30'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-1">
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    role.is_locked
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-primary-deep/10 text-primary-deep dark:bg-primary-deep/20 dark:text-lighter-gray'
                  }`}
                >
                  {role.is_locked ? 'Master' : 'LMS Role'}
                </span>
                {role.is_locked && <Lock size={12} className="text-amber-500" />}
              </div>

              <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white" title={role.name}>
                {role.name}
              </h4>

              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Privilege Count</p>
                <p className="font-mono text-sm font-bold leading-none text-slate-800 dark:text-white">
                  {granted}
                  <span className="text-[10px] font-normal text-slate-400">/{totalPermissions}</span>
                </p>
              </div>

              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    role.is_locked
                      ? 'bg-amber-500'
                      : percentage > 70
                        ? 'bg-emerald-500'
                        : percentage > 40
                          ? 'bg-primary-deep'
                          : 'bg-rose-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="mt-2 truncate text-[9px] font-medium text-slate-400">
                {role.description || role.slug}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 lg:flex-row">
        <div className="relative w-full lg:max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder('Permissions', 'Modules', 'Codes')}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-primary-deep focus:ring-1 focus:ring-primary-deep dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-200"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
          <AppSelect
            value={selectedModuleFilter}
            onValueChange={setSelectedModuleFilter}
            options={[
              { value: 'all', label: 'All Modules' },
              ...modules.map((m) => ({ value: m.module, label: m.name })),
            ]}
            triggerClassName="w-[160px]"
          />

          <AppSelect
            value={selectedPermissionType}
            onValueChange={setSelectedPermissionType}
            options={ACTION_FILTER_OPTIONS}
            triggerClassName="w-[180px]"
          />

          <button
            onClick={() => void loadMatrixData(true)}
            disabled={refreshing}
            type="button"
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-850"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-150 bg-[#f8f9fe] px-6 py-3 dark:border-slate-850 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary-deep" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              LMS Operations Access Grid ({filteredPermissions.length} Active Rows)
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          {groupedPermissions.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Search size={22} className="mx-auto mb-3 text-slate-300" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                No Permissions Match Your Filter
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/50 font-bold text-slate-450 dark:border-slate-800 dark:bg-slate-955/20">
                  <th className="sticky left-0 z-10 min-w-[280px] border-r border-slate-100 bg-white p-4 pl-6 text-[10px] font-bold uppercase tracking-widest text-primary-deep shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] dark:border-slate-850 dark:bg-slate-900">
                    System Module & Privilege Row
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.slug}
                      className={`min-w-[125px] border-b border-slate-150 p-4 text-center transition-colors dark:border-slate-800 ${
                        hoveredRole === role.slug ? 'bg-slate-50/75 text-primary-deep dark:bg-slate-955/40' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold uppercase leading-none text-slate-800 dark:text-white">
                          {role.name}
                        </span>
                        <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 dark:bg-slate-800">
                          {roleCounts[role.slug] || 0}/{totalPermissions}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-150 font-medium dark:divide-slate-800/60">
                {groupedPermissions.map(({ module, items }) => (
                  <React.Fragment key={module.module}>
                    <tr className="border-y border-slate-150 bg-[#fcfdfe] dark:border-slate-800 dark:bg-slate-950">
                      <td
                        colSpan={roles.length + 1}
                        className="bg-slate-50/30 p-3 pl-6 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-1.5 rounded-sm bg-primary-deep dark:bg-indigo-500" />
                          <span>{module.name}</span>
                          <span className="ml-2 font-mono text-[9px] font-semibold lowercase normal-case italic text-slate-400">
                            • {module.description}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {items.map((permission) => (
                      <tr
                        key={permission.code}
                        className="group transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-850/10"
                      >
                        <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-white p-3 pl-8 text-left text-xs shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] dark:border-slate-850 dark:bg-slate-900">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100">
                                {permission.name}
                              </span>
                              <p className="mt-0.5 text-[10px] leading-none text-slate-400" title={permission.description}>
                                {permission.code} — {permission.description}
                              </p>
                            </div>
                            {permission.is_critical && (
                              <span className="shrink-0 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wider text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                                Critical
                              </span>
                            )}
                          </div>
                        </td>

                        {roles.map((role) => {
                          const isChecked = !!matrix[role.slug]?.[permission.code];
                          const isLocked = role.is_locked;
                          const canTogglePermission =
                            canEditMatrix &&
                            (!permission.is_critical || canGrantDeletePermission);

                          return (
                            <td
                              key={role.slug}
                              className={`p-3 text-center transition-colors ${
                                hoveredRole === role.slug ? 'bg-slate-50/30 dark:bg-slate-950/20' : ''
                              }`}
                            >
                              <div className="flex items-center justify-center">
                                {isLocked ? (
                                  <div className="group/lock relative hover:cursor-not-allowed">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500 shadow-inner dark:border-amber-950 dark:bg-slate-900">
                                      <Lock size={10} className="stroke-[3]" />
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!canTogglePermission}
                                    onClick={() => handleToggleCheckbox(role, permission)}
                                    title={
                                      permission.is_critical && !canGrantDeletePermission
                                        ? 'Only Super Admin can grant or revoke delete permissions'
                                        : undefined
                                    }
                                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all focus:outline-none ${
                                      !canTogglePermission
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'cursor-pointer'
                                    } ${
                                      isChecked
                                        ? permission.is_critical
                                          ? 'border-rose-600 bg-rose-500 text-white shadow-sm'
                                          : 'border-secondary-dark bg-primary-deep text-white shadow-sm dark:bg-secondary-dark/60'
                                        : 'border-slate-300 bg-transparent hover:border-slate-500 dark:border-slate-705'
                                    }`}
                                  >
                                    {isChecked && <Check size={12} className="stroke-[3]" />}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-150 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="text-secondary-dark/80" size={16} />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Role Modification Verification & Audit Log
              </h3>
              <p className="mt-0.5 text-[10px] italic text-slate-400 dark:text-slate-500">
                Loaded from backend permission change records
              </p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[400px] space-y-3.5 overflow-y-auto pr-2">
          {auditLogs.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No permission changes recorded yet.</p>
          ) : (
            auditLogs.map((log) => {
              const isGrant = log.action_type === 'grant';
              return (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-150 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-950/20 dark:hover:bg-slate-950/40 md:flex-row md:items-center"
                >
                  <div className="max-w-xl space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                          isGrant
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                            : 'border border-rose-500/20 bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {isGrant ? 'GRANT ACTION' : 'REVOKE ACTION'}
                      </span>
                      <span className="text-[10px] font-bold text-[#223887] dark:text-slate-201">
                        {formatPersonName(log.actor_name)} ({log.actor_role})
                      </span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatAppDateTimeOrFallback(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Modified Role:{' '}
                      <span className="rounded bg-slate-105 px-1.5 py-0.5 font-bold text-slate-900 dark:bg-slate-900 dark:text-white">
                        {log.role_name}
                      </span>
                      <span className="mx-2">→</span>
                      {isGrant ? 'Granted' : 'Revoked'} privilege{' '}
                      <span className="font-mono font-bold text-primary-deep dark:text-lighter-gray">
                        "{log.permission_name}"
                      </span>{' '}
                      under {log.module_name}.
                    </p>
                  </div>

                  {log.file_name && (
                    <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-deep/5 text-primary-deep dark:bg-primary-deep/25">
                        <FileCheck size={16} />
                      </div>
                      <div className="max-w-[150px] overflow-hidden">
                        {log.approval_email_url ? (
                          <a
                            href={log.approval_email_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-[11px] font-bold text-slate-800 hover:underline dark:text-slate-200"
                            title={log.file_name}
                          >
                            {log.file_name}
                          </a>
                        ) : (
                          <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200" title={log.file_name}>
                            {log.file_name}
                          </p>
                        )}
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                          verified {log.file_size}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {pendingChange && (
          <div className={MODAL_OVERLAY_CLASS}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(MODAL_PANEL_CLASS, 'relative max-w-lg')}
            >
              <form onSubmit={(e) => void handleSaveChangesConfirm(e)}>
                <div
                  className={`flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-white ${
                    pendingChange.actionLabel === 'grant' ? 'bg-primary-deep' : 'bg-rose-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert size={14} className="stroke-[2.5]" />
                    {pendingChange.actionLabel === 'grant'
                      ? 'Compliance: Grant Permission'
                      : 'Compliance: Revoke Permission'}
                  </span>
                  <button
                    onClick={() => {
                      setPendingChange(null);
                      setUploadedFile(null);
                    }}
                    type="button"
                    className="rounded-full p-0.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <CircleX className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-4 p-6 text-xs text-slate-700 dark:text-slate-300">
                  {pendingChange.isCritical && (
                    <div className="flex gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-rose-700">
                      <ShieldAlert size={20} className="shrink-0 text-rose-600" />
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-wider">
                          Critical permission warning
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium leading-normal">
                          Only Super Admin can grant or revoke delete permissions.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 rounded-xl border border-slate-150 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] font-semibold uppercase leading-none tracking-widest text-slate-500">
                      Security policy statement
                    </p>
                    <p className="text-xs leading-relaxed">
                      You are attempting to{' '}
                      <span
                        className={`font-bold uppercase ${
                          pendingChange.actionLabel === 'grant' ? 'text-primary-deep' : 'text-rose-500'
                        }`}
                      >
                        {pendingChange.actionLabel}
                      </span>{' '}
                      the following permission for role {pendingChange.roleName}:
                    </p>
                    <div className="space-y-0.5 border-l-4 border-primary-deep py-1 pl-3 dark:border-indigo-500">
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {pendingChange.permissionName}
                      </p>
                      <p className="text-[10px] text-slate-400">{pendingChange.permissionCode}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Validation Proof Upload (PDF, MSG, EML, PNG, JPG) <span className="text-red-500">*</span>
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('dialog-file-input')?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                        isDragActive
                          ? 'border-primary-deep bg-primary-deep/5'
                          : uploadedFile
                            ? 'border-emerald-500 bg-emerald-500/5'
                            : 'border-slate-300 bg-slate-50/50 hover:border-slate-450 dark:bg-slate-950/20'
                      }`}
                    >
                      <input
                        type="file"
                        id="dialog-file-input"
                        onChange={handleFileChange}
                        accept=".pdf,.msg,.eml,.png,.jpg,.jpeg"
                        className="hidden"
                      />
                      {uploadedFile ? (
                        <div className="space-y-2">
                          <FileText size={20} className="mx-auto text-emerald-600" />
                          <p className="text-xs font-bold leading-snug text-slate-800 dark:text-slate-200">
                            {uploadedFile.name}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload size={24} className="mx-auto text-slate-400" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Drag and drop verification document here
                          </p>
                        </div>
                      )}
                    </div>
                    {fileError && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                        <ShieldAlert size={11} />
                        {fileError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-150 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    onClick={() => {
                      setPendingChange(null);
                      setUploadedFile(null);
                    }}
                    type="button"
                    className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-650 transition-colors hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-1.5 text-xs font-bold text-white shadow-sm ${
                      pendingChange.actionLabel === 'grant'
                        ? 'bg-primary-deep hover:opacity-90'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save & Log Compliance'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
