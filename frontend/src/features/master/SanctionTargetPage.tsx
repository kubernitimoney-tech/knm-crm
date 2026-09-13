import React from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/button';

export const SanctionTargetPage = () => {
  useTitle('Sanction Targets');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs />
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary-deep hover:bg-slate-100"
            onClick={() => navigate('/master/category')}
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Sanction Targets</h1>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border border-dashed border-slate-200">
         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <h1 className="text-4xl">?</h1>
         </div>
         <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Configuration module pending</p>
         <p className="text-xs text-slate-400 mt-2">This module is currently being finalized for production.</p>
      </div>
    </div>
  );
};
