import React from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  PlusCircle,
  MapPin,
  ShieldCheck,
  CheckSquare,
  CalendarDays,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

import { usePermissions } from '@/hooks/usePermissions';

const CATEGORIES = [
  {
    id: 'optional-module',
    title: 'Optional Module',
    description: 'Configure and toggle optional system modules',
    icon: PlusCircle,
    color: 'bg-blue-50 text-blue-600',
    path: '/master/category/optional-module'
  },
  {
    id: 'branch-target',
    title: 'Branch Target',
    description: 'Set and manage sales targets for different branches',
    icon: MapPin,
    color: 'bg-emerald-50 text-emerald-600',
    path: '/master/category/branch-target'
  },
  {
    id: 'bank-holidays',
    title: 'Bank Holidays',
    description: 'Maintain RBI bank holidays by financial year',
    icon: CalendarDays,
    color: 'bg-sky-50 text-sky-600',
    path: '/master/category/bank-holidays'
  },
  {
    id: 'sanction-target',
    title: 'Sanction Target',
    description: 'Monitor and define sanctioning goals',
    icon: ShieldCheck,
    color: 'bg-amber-50 text-amber-600',
    path: '/master/category/sanction-target'
  },
  {
    id: 'approval-matrix',
    title: 'Approval Matrix',
    description: 'Define hierarchy and range for loan approvals',
    icon: CheckSquare,
    color: 'bg-purple-50 text-purple-600',
    path: '/master/category/approval-matrix'
  },
  {
    id: 'permission-matrix',
    title: 'RBAC Permission Matrix',
    description: 'Manage core role access controls, grant/revoke approvals, and audit permission matrices',
    icon: ShieldCheck,
    color: 'bg-rose-50 text-rose-600',
    path: '/master/category/permission-matrix'
  },
  {
    id: 'permissions-hub',
    title: 'Permission System',
    description: 'Catalog, roles, assignments, matrix, and user overrides in one place',
    icon: ShieldCheck,
    color: 'bg-slate-100 text-slate-700',
    path: '/master/permissions'
  }
];

export const MasterCategoryPage = () => {
  useTitle('System Settings');
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const visibleCategories = CATEGORIES.filter((category) => {
    if (category.id === 'permission-matrix' || category.id === 'permissions-hub') {
      return (
        hasPermission('permission.view') ||
        hasPermission('role.view') ||
        hasPermission('user.view')
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-1">
        <Breadcrumbs />
        <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 font-medium">Manage core system configurations and business rules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleCategories.map((category, idx) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => navigate(category.path)}
            className="group relative bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-primary-deep/20 transition-all cursor-pointer overflow-hidden"
          >
            {/* Background Decoration */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${category.color} opacity-10 group-hover:scale-150 transition-transform duration-500`} />

            <div className="relative z-10 flex flex-col h-full">
              <div className={`w-14 h-14 ${category.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <category.icon size={28} />
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-primary-deep transition-colors">
                {category.title}
              </h3>

              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                {category.description}
              </p>

              <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-primary-deep uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Configure Now
                <div className="w-5 h-5 rounded-full bg-primary-deep text-white flex items-center justify-center">
                  <PlusCircle size={10} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
