import React from 'react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '../ui/Breadcrumbs';

export const PlaceholderPage = ({ title }: { title: string }) => {
  useTitle(title);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Breadcrumbs />
      <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 ring-1 ring-slate-100">
          <div className="w-8 h-8 border-2 border-slate-200 rounded animate-pulse" />
        </div>
        <h1 className="text-[22px] font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-500 max-w-md mx-auto">
          This module is currently under development. The enterprise-grade interface for {title.toLowerCase()} is ready for backend integration.
        </p>
        <button className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
          Go Back to Dashboard
        </button>
      </div>
    </div>
  );
};
