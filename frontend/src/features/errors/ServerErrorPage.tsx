import type React from 'react';
import { ServerCrash, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorLayout } from './ErrorLayout';

interface ServerErrorPageProps {
  code?: string;
  title?: string;
  description?: React.ReactNode;
  /** Technical detail shown in a collapsible block (dev-friendly). */
  detail?: string;
}

export const ServerErrorPage = ({
  code = '500',
  title = 'Something went wrong',
  description = "An unexpected error occurred on our end. The issue has been logged and our team is looking into it. Please try again in a moment.",
  detail,
}: ServerErrorPageProps) => {
  return (
    <ErrorLayout
      code={code}
      title={title}
      icon={ServerCrash}
      accent="rose"
      description={description}
    >
      <div className="flex flex-col items-center gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="h-11 px-5 rounded-xl font-semibold"
        >
          <RotateCw size={16} />
          Reload Page
        </Button>

        {detail && (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              Technical details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-slate-900 p-4 text-left text-[11px] leading-relaxed text-rose-200 whitespace-pre-wrap break-words">
              {detail}
            </pre>
          </details>
        )}
      </div>
    </ErrorLayout>
  );
};
