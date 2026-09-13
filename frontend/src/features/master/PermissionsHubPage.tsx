import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpen,
  Users,
  UserCog,
  Grid3X3,
  UserPlus,
  Shield,
} from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { usePermissions } from '@/hooks/usePermissions';

const PILLARS = [
  {
    id: 'catalog',
    title: 'Permission Catalog',
    description: 'Master list of every permission code (module.action) available in the system.',
    icon: BookOpen,
    color: 'bg-sky-50 text-sky-600',
    path: '/master/permissions/catalog',
    required: 'permission.view' as const,
  },
  {
    id: 'roles',
    title: 'Roles',
    description: 'Role definitions with permission and user assignment counts.',
    icon: Users,
    color: 'bg-indigo-50 text-indigo-600',
    path: '/master/permissions/roles',
    required: 'role.view' as const,
  },
  {
    id: 'assignments',
    title: 'Role Assignment',
    description: 'See who holds each role and open user records to assign or change roles.',
    icon: UserCog,
    color: 'bg-emerald-50 text-emerald-600',
    path: '/master/permissions/assignments',
    required: 'user.view' as const,
  },
  {
    id: 'matrix',
    title: 'Role Permission Matrix',
    description: 'Grant or revoke permissions on roles with approval evidence and audit.',
    icon: Grid3X3,
    color: 'bg-rose-50 text-rose-600',
    path: '/master/permission-matrix',
    required: 'permission.view' as const,
  },
  {
    id: 'overrides',
    title: 'User Permission Overrides',
    description: 'Direct grants on a user beyond their role template, with audit history.',
    icon: UserPlus,
    color: 'bg-amber-50 text-amber-600',
    path: '/master/permissions/overrides',
    required: 'user.view' as const,
  },
];

export const PermissionsHubPage = () => {
  useTitle('Permissions');
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const visible = PILLARS.filter((item) => hasPermission(item.required));

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-1">
        <Breadcrumbs />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep/10 text-primary-deep">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-950">
              Permission System
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Catalog, roles, assignments, matrix, and user-level overrides
            </p>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-slate-150 bg-white p-8 text-center text-sm text-slate-500">
          You do not have permission to manage or view RBAC configuration.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, idx) => (
            <motion.button
              type="button"
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              onClick={() => navigate(item.path)}
              className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-7 text-left shadow-sm transition-all hover:border-primary-deep/20 hover:shadow-xl"
            >
              <div
                className={`absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 ${item.color} transition-transform duration-500 group-hover:scale-150`}
              />
              <div className="relative z-10 space-y-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}
                >
                  <item.icon size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{item.title}</h2>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                </div>
                <span className="inline-flex text-[11px] font-bold uppercase tracking-wider text-primary-deep">
                  Open →
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};
