import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeadWorkflowPendingBannerProps {
  message: string;
  previousStep?: string;
  onGoToPrevious?: () => void;
}

export function LeadWorkflowPendingBanner({
  message,
  previousStep,
  onGoToPrevious,
}: LeadWorkflowPendingBannerProps) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
          <AlertCircle size={18} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-200">
            {previousStep ? `${previousStep} action pending` : 'Previous step pending'}
          </p>
          <p className="text-[11px] text-amber-900/90 dark:text-amber-100/90 font-medium leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      {previousStep && onGoToPrevious && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs font-bold rounded-lg border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200"
          onClick={onGoToPrevious}
        >
          Go to {previousStep}
        </Button>
      )}
    </div>
  );
}
