import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { AppFooter } from '../components/layout/AppFooter';
import { useUIStore } from '../store/useUIStore';
import { AuthGuard } from '../components/auth/AuthGuard';
import { SessionManager } from '../components/auth/SessionManager';

export const DashboardLayout = () => {
  const { sidebarOpen } = useUIStore();

  return (
    <AuthGuard>
    <SessionManager />
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50 overflow-x-hidden relative transition-colors duration-300">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary-deep/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-secondary-dark/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Sidebar />
      <motion.main
        initial={false}
        animate={{ paddingLeft: sidebarOpen ? 240 : 80 }}
        className="flex flex-col min-h-screen transition-all duration-300"
      >
        <Navbar />
        <div className="flex-1 p-6 lg:p-8">
          <div className="w-full">
            <Outlet />
          </div>
        </div>
        <AppFooter />
      </motion.main>
    </div>
    </AuthGuard>
  );
};
