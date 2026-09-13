import type { CustomerViewModel } from '@/lib/customerProfileUtils';

type LoanDetails = CustomerViewModel['loanDetails'];

interface LoanApplyDetailsCardProps {
  loanDetails: LoanDetails;
  customerName?: string;
  onCustomerNameClick?: () => void;
}

export function LoanApplyDetailsCard({
  loanDetails,
  customerName,
  onCustomerNameClick,
}: LoanApplyDetailsCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[14px] p-6 shadow-md shadow-slate-100/50 dark:shadow-none">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
        Loan Apply Details
      </h3>

      <div className="border-b border-slate-100 dark:border-slate-800 my-4" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-[11px] leading-relaxed">
        <div className="space-y-3.5 md:col-span-3 pb-1 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-slate-400 font-medium">Customer Name:</span>{' '}
            {onCustomerNameClick && customerName && customerName !== '—' ? (
              <button
                type="button"
                onClick={onCustomerNameClick}
                className="text-slate-800 dark:text-slate-100 font-bold uppercase tracking-wide select-all hover:text-primary-deep hover:underline transition-colors"
              >
                {customerName}
              </button>
            ) : (
              <span className="text-slate-800 dark:text-slate-100 font-bold uppercase tracking-wide select-all">
                {customerName && customerName !== '—' ? customerName : '—'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <span className="text-slate-400 font-medium">Loan Required:</span>{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-bold select-all">
              {loanDetails.loanRequired}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium">State:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300 font-semibold select-all">
              {loanDetails.state}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Loan Purpose:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300 font-semibold select-all">
              {loanDetails.loanPurpose}
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <span className="text-slate-400 font-medium">Monthly Income:</span>{' '}
            <span className="text-slate-800 dark:text-slate-100 font-bold select-all">
              {loanDetails.monthlyIncome}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium">City:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300 font-semibold select-all">
              {loanDetails.city}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium font-bold">Assigned RM:</span>{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-bold select-all">
              {loanDetails.assignedRM}
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <span className="text-slate-400 font-medium">Source:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300 font-semibold select-all">
              {loanDetails.source}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Pincode:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300 font-semibold select-all">
              {loanDetails.pincode}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium font-bold">Assigned CM:</span>{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-bold select-all">
              {loanDetails.assignedCM}
            </span>
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 pt-2 text-slate-700 dark:text-slate-300">
          <div>
            <span className="text-slate-450 dark:text-slate-400 font-medium">Applied On:</span>{' '}
            <span className="font-bold cursor-text selection:bg-indigo-100">
              {loanDetails.appliedOn}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
