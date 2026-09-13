import type { CustomerViewModel } from '@/lib/customerProfileUtils';
import { cn } from '@/lib/utils';
import { SURFACE_CARD_CLASS } from '@/lib/uiTokens';

interface CustomerProfileSummaryCardProps {
  data: CustomerViewModel;
  statusLabel?: string;
  onNameClick?: () => void;
}

export function CustomerProfileSummaryCard({
  data,
  statusLabel = 'Active',
  onNameClick,
}: CustomerProfileSummaryCardProps) {
  const nameContent = (
    <>
      {data.name} ({data.code})
    </>
  );

  return (
    <div
      id="profile-summary-card"
      className={cn('rounded-[14px] border border-slate-150 p-6 text-center shadow-md shadow-slate-100/50 dark:shadow-none', SURFACE_CARD_CLASS)}
    >
      <div className="mx-auto w-24 h-24 rounded-full border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#2a2d4f] flex items-center justify-center mb-4 overflow-hidden shadow-inner">
        <img
          src={data.avatar}
          alt={data.name}
          className="w-full h-full object-cover"
        />
      </div>

      {onNameClick ? (
        <button
          type="button"
          onClick={onNameClick}
          className="text-sm font-black text-slate-700 dark:text-slate-100 leading-tight hover:text-primary-deep hover:underline transition-colors"
        >
          {nameContent}
        </button>
      ) : (
        <h2 className="text-sm font-black text-slate-700 dark:text-slate-100 leading-tight">
          {nameContent}
        </h2>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1 mb-4 select-all">
        {data.email}
      </p>

      <div className="flex justify-center mb-6">
        <span
          className={cn(
            'text-[10px] font-bold py-1.5 px-6 rounded-md uppercase tracking-wider leading-none shadow-sm select-none',
            statusLabel === 'Inactive'
              ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              : 'bg-primary-deep dark:bg-primary-deep text-white dark:text-lighter-gray shadow-primary-deep/20',
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 text-left border-t border-slate-100 dark:border-slate-800/80 pt-5 text-[11px] font-normal leading-relaxed">
        <div>
          <span className="text-slate-400 font-medium">Mobile:</span>{' '}
          <span className="text-slate-600 dark:text-slate-350 font-semibold">{data.mobile}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 font-medium">Lead ID:</span>{' '}
          <span className="text-slate-600 dark:text-slate-350 font-semibold">{data.leadId}</span>
        </div>

        <div>
          <span className="text-slate-400 font-medium">DOB:</span>{' '}
          <span className="text-slate-600 dark:text-slate-350 font-semibold">{data.dob}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 font-medium">Gender:</span>{' '}
          <span className="text-slate-600 dark:text-slate-350 font-semibold">{data.gender}</span>
        </div>

        <div className="col-span-2 flex justify-between">
          <span>
            <span className="text-slate-400 font-medium">Pan:</span>{' '}
            <span className="text-slate-600 dark:text-slate-350 font-semibold font-mono uppercase">
              {data.pan}
            </span>
          </span>
          <span className="text-right">
            <span className="text-slate-400 font-medium">Adhaar:</span>{' '}
            <span className="text-slate-600 dark:text-slate-350 font-semibold font-mono">
              {data.aadhaar}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
