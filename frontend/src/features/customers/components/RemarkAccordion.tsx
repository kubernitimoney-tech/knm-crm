import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { AppSelect } from '@/components/ui/app-select';
import { Remark } from './types';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface RemarkAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  onSave: (data: Omit<Remark, 'id' | 'customerId' | 'createdAt'>) => void;
  onCancel: () => void;
}

export const RemarkAccordion: React.FC<RemarkAccordionProps> = ({
  isOpen,
  onToggle,
  onSave,
  onCancel
}) => {
  // Form State
  const [remarkCategory, setRemarkCategory] = useState('Promise to Pay (PTP)');
  const [followUpDate, setFollowUpDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [assignedTo, setAssignedTo] = useState('Madhu');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setRemarkCategory('Promise to Pay (PTP)');
    setFollowUpDate('');
    setPriority('Medium');
    setAssignedTo('Madhu');
    setNotes('');
    setErrors({});
  };

  const handleValidation = () => {
    const newErrors: { [key: string]: string } = {};
    if (!notes.trim()) {
      newErrors.notes = 'Remark Notes are required to save a remark';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleValidation()) return;

    setIsSubmitting(true);
    // Simulate API Saving delay
    setTimeout(() => {
      onSave({
        remarkCategory,
        followUpDate,
        priority,
        assignedTo,
        notes
      });
      setIsSubmitting(false);
      resetForm();
    }, 300);
  };

  const handleCancelClick = () => {
    resetForm();
    onCancel();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[14px] overflow-hidden shadow-sm transition-all duration-300">
      {/* Header Button clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3.5 bg-primary-deep dark:bg-primary-deep/80 hover:bg-secondary-dark dark:hover:bg-secondary-dark/80 text-white font-bold text-xs uppercase tracking-wider text-left transition-colors focus:outline-none focus:ring-1 focus:ring-blue-450 select-none cursor-pointer"
        type="button"
      >
        <span>Add Remark</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Accordion Body */}
      <div
        className={`transition-all duration-200 overflow-hidden ${
          isOpen ? 'max-h-[800px] border-t border-slate-150 dark:border-slate-800' : 'max-h-0'
        }`}
      >
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Remark Category
                </label>
                <AppSelect
                  value={remarkCategory}
                  onValueChange={setRemarkCategory}
                  options={[
                    'Promise to Pay (PTP)',
                    'Payment Commitment',
                    'DNC / Switched Off',
                    'Wrong Number',
                    'Refused to Pay',
                    'Dispute Settlement',
                    'General Follow-up',
                  ]}
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Follow-up Date
                </label>
                <DatePicker
                  value={followUpDate}
                  onChange={setFollowUpDate}
                  placeholder={selectPlaceholder('Follow-up Date')}
                  size="sm"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Priority
                </label>
                <AppSelect
                  value={priority}
                  onValueChange={(value) => setPriority(value as 'Low' | 'Medium' | 'High')}
                  options={['Low', 'Medium', 'High']}
                />
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Assigned To
                </label>
                <AppSelect
                  value={assignedTo}
                  onValueChange={setAssignedTo}
                  options={['Madhu', 'Gitika Arora', 'Rahul M.', 'Nitin J.']}
                />
              </div>
            </div>

            {/* Note text field full-width */}
            <div>
              <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                Remark Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder={enterPlaceholder('Remark Notes')}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full bg-slate-50/50 dark:bg-slate-950/20 border ${
                  errors.notes ? 'border-red-500 focus:ring-red-400' : 'border-slate-200 dark:border-slate-800 focus:ring-primary-deep'
                } rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2`}
              />
              {errors.notes && (
                <p className="text-red-500 text-[10px] mt-0.5 font-medium">{errors.notes}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelClick}
                className="px-4 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-primary-deep dark:bg-primary-deep/80 border border-primary-deep dark:border-primary-deep/80 hover:opacity-90 transition-opacity text-xs font-semibold text-white ml-2 shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                    Saving...
                  </>
                ) : (
                  'Save Remark'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
