import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { AppSelect } from '@/components/ui/app-select';
import { Collection } from './types';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface CollectionAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  onSave: (data: Omit<Collection, 'id' | 'customerId' | 'createdAt'>) => void;
  onCancel: () => void;
  editingCollection: Collection | null;
}

export const CollectionAccordion: React.FC<CollectionAccordionProps> = ({
  isOpen,
  onToggle,
  onSave,
  onCancel,
  editingCollection
}) => {
  // Form State
  const [collectionDate, setCollectionDate] = useState('');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [collectionStatus, setCollectionStatus] = useState<'Received' | 'Pending' | 'Failed'>('Received');
  const [transactionRefNo, setTransactionRefNo] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [bankName, setBankName] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [collectionType, setCollectionType] = useState('EMI Payment');
  const [bounceCharges, setBounceCharges] = useState('');
  const [remarks, setRemarks] = useState('');

  // Validation feedback state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with editing template if editing changes or opens
  useEffect(() => {
    if (editingCollection) {
      setCollectionDate(editingCollection.collectionDate || '');
      setCollectionAmount(String(editingCollection.collectionAmount || ''));
      setPaymentMode(editingCollection.paymentMode || '');
      setCollectionStatus(editingCollection.collectionStatus || 'Received');
      setTransactionRefNo(editingCollection.transactionRefNo || '');
      setCollectedBy(editingCollection.collectedBy || '');
      setBankName(editingCollection.bankName || '');
      setDepositDate(editingCollection.depositDate || '');
      setNextFollowUpDate(editingCollection.nextFollowUpDate || '');
      setReceiptNumber(editingCollection.receiptNumber || '');
      setCollectionType(editingCollection.collectionType || 'EMI Payment');
      setBounceCharges(String(editingCollection.bounceCharges || ''));
      setRemarks(editingCollection.remarks || '');
      setErrors({});
    } else {
      resetForm();
    }
  }, [editingCollection]);

  const resetForm = () => {
    setCollectionDate('');
    setCollectionAmount('');
    setPaymentMode('');
    setCollectionStatus('Received');
    setTransactionRefNo('');
    setCollectedBy('');
    setBankName('');
    setDepositDate('');
    setNextFollowUpDate('');
    setReceiptNumber('');
    setCollectionType('EMI Payment');
    setBounceCharges('');
    setRemarks('');
    setErrors({});
  };

  const handleValidation = () => {
    const newErrors: { [key: string]: string } = {};
    if (!collectionDate) newErrors.collectionDate = 'Collection Date is required';
    if (!collectionAmount || parseFloat(collectionAmount) <= 0 || isNaN(Number(collectionAmount))) {
      newErrors.collectionAmount = 'Valid Collection Amount is required';
    }
    if (!paymentMode) newErrors.paymentMode = 'Payment Mode is required';

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
        collectionDate,
        collectionAmount: parseFloat(collectionAmount),
        paymentMode,
        collectionStatus,
        transactionRefNo,
        collectedBy,
        bankName,
        depositDate,
        nextFollowUpDate,
        receiptNumber,
        collectionType,
        bounceCharges: bounceCharges ? parseFloat(bounceCharges) : 0,
        remarks
      });
      setIsSubmitting(false);
      resetForm();
    }, 400);
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
        <span className="flex items-center gap-2">
          {editingCollection ? 'Edit Collection Details' : 'Add Collection'}
          {editingCollection && (
            <span className="bg-emerald-500 text-[9px] uppercase px-2 py-0.5 rounded text-white font-black animate-pulse">
              Editing Mode
            </span>
          )}
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Accordion Body */}
      <div
        className={`transition-all duration-200 overflow-hidden ${
          isOpen ? 'max-h-[1400px] border-t border-slate-150 dark:border-slate-800' : 'max-h-0'
        }`}
      >
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Row 1 - Col 1: Collection Date */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Collection Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={collectionDate}
                  onChange={setCollectionDate}
                  placeholder={selectPlaceholder('Collection Date')}
                  size="sm"
                  triggerClassName={
                    errors.collectionDate ? 'border-red-500 focus:ring-red-400' : undefined
                  }
                />
                {errors.collectionDate && (
                  <p className="text-red-500 text-[10px] mt-0.5 font-medium">{errors.collectionDate}</p>
                )}
              </div>

              {/* Row 1 - Col 2: Collection Amount */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Collection Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder={enterPlaceholder('Collection Amount')}
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(e.target.value)}
                  className={`w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border ${
                    errors.collectionAmount ? 'border-red-500 focus:ring-red-400' : 'border-slate-200 dark:border-slate-800 focus:ring-primary-deep'
                  } rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2`}
                />
                {errors.collectionAmount && (
                  <p className="text-red-500 text-[10px] mt-0.5 font-medium">{errors.collectionAmount}</p>
                )}
              </div>

              {/* Row 1 - Col 3: Payment Mode */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <AppSelect
                  value={paymentMode}
                  onValueChange={setPaymentMode}
                  placeholder={selectPlaceholder('Payment Mode')}
                  options={['Cash', 'Cheque', 'Net Banking', 'UPI', 'UPI Auto-Debit', 'IMPS / NEFT']}
                />
                {errors.paymentMode && (
                  <p className="text-red-500 text-[10px] mt-0.5 font-medium">{errors.paymentMode}</p>
                )}
              </div>

              {/* Row 1 - Col 4: Collection Status */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Collection Status
                </label>
                <AppSelect
                  value={collectionStatus}
                  onValueChange={(value) => setCollectionStatus(value as Collection['collectionStatus'])}
                  options={['Received', 'Pending', 'Failed']}
                />
              </div>

              {/* Row 2 - Col 1: Transaction Ref No */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Transaction Reference No.
                </label>
                <input
                  type="text"
                  placeholder={enterPlaceholder('Transaction Reference No.')}
                  value={transactionRefNo}
                  onChange={(e) => setTransactionRefNo(e.target.value)}
                  className="w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
                />
              </div>

              {/* Row 2 - Col 2: Collected By */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Collected By
                </label>
                <input
                  type="text"
                  placeholder={enterPlaceholder('Collected By')}
                  value={collectedBy}
                  onChange={(e) => setCollectedBy(e.target.value)}
                  className="w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
                />
              </div>

              {/* Row 2 - Col 3: Bank Name */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder={enterPlaceholder('Bank Name')}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
                />
              </div>

              {/* Row 2 - Col 4: Deposit Date */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Deposit Date
                </label>
                <DatePicker
                  value={depositDate}
                  onChange={setDepositDate}
                  placeholder={selectPlaceholder('Deposit Date')}
                  size="sm"
                />
              </div>

              {/* Row 3 - Col 1: Next Follow-up Date */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Next Follow-up Date
                </label>
                <DatePicker
                  value={nextFollowUpDate}
                  onChange={setNextFollowUpDate}
                  placeholder={selectPlaceholder('Follow-up Date')}
                  size="sm"
                />
              </div>

              {/* Row 3 - Col 2: Receipt Number */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Receipt Number
                </label>
                <input
                  type="text"
                  placeholder={enterPlaceholder('Receipt Number')}
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
                />
              </div>

              {/* Row 3 - Col 3: Collection Type */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Collection Type
                </label>
                <AppSelect
                  value={collectionType}
                  onValueChange={setCollectionType}
                  options={[
                    'EMI Payment',
                    'Part Payment',
                    'Full Settlement',
                    'Bounce Charges',
                    'Prepayment',
                  ]}
                />
              </div>

              {/* Row 3 - Col 4: Bounce Charges */}
              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                  Bounce Charges (₹)
                </label>
                <input
                  type="number"
                  placeholder={enterPlaceholder('Bounce Charges')}
                  value={bounceCharges}
                  onChange={(e) => setBounceCharges(e.target.value)}
                  className="w-full h-8 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
                />
              </div>
            </div>

            {/* Row 4 - Textarea (Full Width) */}
            <div>
              <label className="block text-slate-400 dark:text-slate-500 font-bold mb-1 text-[11px] uppercase tracking-wider">
                Remarks
              </label>
              <textarea
                placeholder={enterPlaceholder('Remarks')}
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-deep"
              />
            </div>

            {/* Actions Buttons */}
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
                className="px-4 py-1.5 rounded-lg bg-primary-deep dark:bg-primary-deep/80 border border-primary-deep dark:border-primary-deep/80 hover:opacity-90 transition-opacity text-xs font-semibold text-white ml-2 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                    Saving...
                  </>
                ) : editingCollection ? (
                  'Update Collection'
                ) : (
                  'Save Collection'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
