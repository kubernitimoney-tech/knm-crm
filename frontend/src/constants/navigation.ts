import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Wallet,
  HandCoins,
  AlertTriangle,
  BarChart3,
  UserPlus,
  Fingerprint,
  PieChart,
  Settings,
} from 'lucide-react';
import type { NavSection } from './permissions';

export interface NavSubItem {
  title: string;
  path: string;
  section?: NavSection;
}

export interface NavItem {
  title: string;
  icon?: LucideIcon;
  path?: string;
  section?: NavSection;
  submenu?: NavSubItem[];
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    section: 'dashboard',
  },
  {
    title: 'Leads Management',
    icon: Users,
    section: 'leads',
    submenu: [
      { title: 'Status Wise', path: '/leads/status', section: 'leads' },
      { title: 'All Leads', path: '/leads/all', section: 'leads' },
    ],
  },
  {
    title: 'Sanction',
    icon: ShieldCheck,
    section: 'sanction',
    submenu: [
      { title: 'Approved', path: '/sanctions/approved', section: 'sanction' },
      { title: 'Pending For Approval', path: '/sanctions/pending', section: 'sanction' },
      { title: 'Rejected', path: '/sanctions/rejected', section: 'sanction' },
      { title: 'E-Nach Registration', path: '/sanctions/enach', section: 'sanction' },
    ],
  },
  {
    title: 'Disbursal',
    icon: Wallet,
    section: 'disbursal',
    submenu: [
      { title: 'Disbursal Sheet Send', path: '/disbursal/sheet', section: 'disbursal' },
      { title: 'Disbursed', path: '/disbursal/completed', section: 'disbursal' },
    ],
  },
  {
    title: 'Collection',
    icon: HandCoins,
    section: 'collection',
    submenu: [
      { title: 'Cash Pending', path: '/collection/pending', section: 'collection' },
      { title: 'Part Payment', path: '/collection/partial', section: 'collection' },
      { title: 'Closed', path: '/collection/closed', section: 'collection' },
      { title: 'Settlement', path: '/collection/settlement', section: 'collection' },
    ],
  },
  {
    title: 'Red Flag',
    icon: AlertTriangle,
    path: '/red-flag',
    section: 'red-flag',
  },
  {
    title: 'Reporting',
    icon: BarChart3,
    section: 'reporting',
    submenu: [
      { title: 'Cibil Report', path: '/reports/cibil', section: 'reporting' },
      { title: 'All Reporting Data', path: '/reports/all', section: 'reporting' },
      // Hidden until client permission is granted — route remains: /reports/activity-logs
      // { title: 'Activity Logs', path: '/reports/activity-logs', section: 'reporting' },
    ],
  },
  {
    title: 'Lead Assignment',
    icon: UserPlus,
    section: 'assignments',
    submenu: [
      { title: 'RM List', path: '/assignments/rm', section: 'assignments' },
      { title: 'CM List', path: '/assignments/cm', section: 'assignments' },
      { title: 'Matrix Loan Approval', path: '/assignments/matrix', section: 'assignments' },
    ],
  },
  {
    title: 'KYC',
    icon: Fingerprint,
    section: 'kyc',
    submenu: [
      { title: 'E-Sign', path: '/kyc/esign', section: 'kyc' },
      { title: 'Video KYC', path: '/kyc/video', section: 'kyc' },
    ],
  },
  {
    title: 'Marketing Analysis',
    icon: PieChart,
    section: 'marketing',
    submenu: [
      { title: 'Branch-Wise Reports', path: '/marketing/branch', section: 'marketing' },
      { title: 'UTM-Wise Reports', path: '/marketing/utm', section: 'marketing' },
    ],
  },
  {
    title: 'Master',
    icon: Settings,
    section: 'master',
    submenu: [
      { title: 'Users', path: '/master/users', section: 'master' },
      { title: 'Permissions', path: '/master/permissions', section: 'master' },
      { title: 'Settings', path: '/master/category', section: 'master' },
      { title: 'Permission Matrix', path: '/master/permission-matrix', section: 'master' },
    ],
  },
];
