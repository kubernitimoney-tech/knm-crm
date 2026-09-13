import React, { useState, useEffect } from 'react';
import { CollectionAccordion } from './CollectionAccordion';
import { RemarkAccordion } from './RemarkAccordion';
import { CollectionDetailsTable } from './CollectionDetailsTable';
import { Collection, Remark } from './types';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface CollectionTabProps {
  customerId: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

export const CollectionTab: React.FC<CollectionTabProps> = ({ customerId }) => {
  const { hasPermission } = usePermissions();
  const canViewCollection = hasPermission('collection.view');
  const canCreateCollection = hasPermission('collection.create');
  const canUpdateCollection = hasPermission('collection.update');
  const canDeleteCollection = hasPermission('collection.delete');
  const canExportCollection = hasPermission('collection.export');
  // Accordion open/close state logic (Only one open at a time)
  // Default: Collection expanded, Remark collapsed.
  const [activeSection, setActiveSection] = useState<'collection' | 'remark' | null>('collection');

  // Datasets loaded from localStorage or seeded
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Editing state for collection
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  // Toast stack state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Trigger toast alert helper
  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = String(Date.now() + Math.random());
    setToasts(prev => [...prev, { id, type, text }]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Seed default collections and remarks if not present in localStorage
  useEffect(() => {
    setIsLoading(true);
    const storageCollectionsKey = `lms_collections_${customerId}`;
    const storageRemarksKey = `lms_remarks_${customerId}`;

    const storedCollections = localStorage.getItem(storageCollectionsKey);
    const storedRemarks = localStorage.getItem(storageRemarksKey);

    let initialCols: Collection[] = [];
    if (storedCollections) {
      initialCols = JSON.parse(storedCollections);
    } else {
      // Seed beautiful mockup collection entries to match LMS theme
      initialCols = [
        {
          id: 'COL-601938',
          customerId,
          collectionDate: '2026-06-01',
          collectionAmount: 5400,
          paymentMode: 'UPI Auto-Debit',
          collectionStatus: 'Received',
          transactionRefNo: 'UPI920485906803',
          collectedBy: 'Nitin J.',
          bankName: 'KARNATAKA BANK LIMITED',
          depositDate: '2026-06-01',
          nextFollowUpDate: '2026-07-01',
          receiptNumber: 'REC-2026-9041',
          collectionType: 'EMI Payment',
          bounceCharges: 0,
          remarks: 'Automated NACH clearance debited successfully.',
          createdAt: new Date(Date.now() - 240 * 60000).toISOString()
        },
        {
          id: 'COL-601910',
          customerId,
          collectionDate: '2026-05-28',
          collectionAmount: 12000,
          paymentMode: 'Cheque',
          collectionStatus: 'Pending',
          transactionRefNo: 'CHQ428105',
          collectedBy: 'Madhu',
          bankName: 'STATE BANK OF INDIA',
          depositDate: '2026-05-29',
          nextFollowUpDate: '2026-06-15',
          receiptNumber: 'REC-2026-8975',
          collectionType: 'Part Payment',
          bounceCharges: 0,
          remarks: 'Cheque deposited in Bangalore branch, awaiting clearing house response.',
          createdAt: new Date(Date.now() - 1440 * 60000).toISOString()
        },
        {
          id: 'COL-601850',
          customerId,
          collectionDate: '2026-05-02',
          collectionAmount: 5400,
          paymentMode: 'Net Banking',
          collectionStatus: 'Failed',
          transactionRefNo: 'TXN849102830193',
          collectedBy: 'Gitika Arora',
          bankName: 'HDFC BANK',
          depositDate: '2026-05-02',
          nextFollowUpDate: '2026-05-05',
          receiptNumber: 'REC-2026-7104',
          collectionType: 'EMI Payment',
          bounceCharges: 450,
          remarks: 'Insufficient balance fail. Contacted customer for bounce charges of 450.',
          createdAt: new Date(Date.now() - 10000 * 60000).toISOString()
        }
      ];
      localStorage.setItem(storageCollectionsKey, JSON.stringify(initialCols));
    }

    if (!storedRemarks) {
      const defaultRemarks: Remark[] = [
        {
          id: 'REM-1004',
          customerId,
          remarkCategory: 'Promise to Pay (PTP)',
          followUpDate: '2026-06-10',
          priority: 'High',
          assignedTo: 'Nitin J.',
          notes: 'Customer promised to pay full overdue EMI plus late charges via UPI on the 10th.',
          createdAt: new Date(Date.now() - 1200 * 60000).toISOString()
        }
      ];
      localStorage.setItem(storageRemarksKey, JSON.stringify(defaultRemarks));
    }

    setCollections(initialCols);
    setIsLoading(false);
  }, [customerId]);

  const handleToggleSection = (section: 'collection' | 'remark') => {
    setActiveSection(prev => (prev === section ? null : section));
  };

  // Add / Edit Collection Saved handler
  const handleSaveCollection = (formData: Omit<Collection, 'id' | 'customerId' | 'createdAt'>) => {
    const storageCollectionsKey = `lms_collections_${customerId}`;
    let updatedCols: Collection[] = [];

    if (editingCollection) {
      // Modify existing
      updatedCols = collections.map(col => {
        if (col.id === editingCollection.id) {
          return {
            ...col,
            ...formData
          };
        }
        return col;
      });
      triggerToast('Collection receipt records updated successfully.', 'success');
      setEditingCollection(null);
    } else {
      // Create new
      const newCol: Collection = {
        ...formData,
        id: `COL-${600000 + Math.floor(Math.random() * 100000)}`,
        customerId,
        createdAt: new Date().toISOString()
      };
      updatedCols = [newCol, ...collections];
      triggerToast('Successfully registered new collection receipt.', 'success');
    }

    setCollections(updatedCols);
    localStorage.setItem(storageCollectionsKey, JSON.stringify(updatedCols));
  };

  const handleCancelCollection = () => {
    setEditingCollection(null);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    // Expand collection and collapse remark
    setActiveSection('collection');
    // Scroll window smooth slightly up to input form container
    const element = document.getElementById('collection-tab-forms-anchor');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDeleteCollection = (id: string) => {
    const storageCollectionsKey = `lms_collections_${customerId}`;
    const updatedCols = collections.filter(col => col.id !== id);
    setCollections(updatedCols);
    localStorage.setItem(storageCollectionsKey, JSON.stringify(updatedCols));

    // Check if we deleted the item we were busy editing
    if (editingCollection && editingCollection.id === id) {
      setEditingCollection(null);
    }

    triggerToast('Collection transaction entry deleted from record books.', 'success');
  };

  // Save Remark handler
  const handleSaveRemark = (formData: Omit<Remark, 'id' | 'customerId' | 'createdAt'>) => {
    const storageRemarksKey = `lms_remarks_${customerId}`;
    const storedRemarks = localStorage.getItem(storageRemarksKey);
    const curRemarks: Remark[] = storedRemarks ? JSON.parse(storedRemarks) : [];

    const newRemark: Remark = {
      ...formData,
      id: `REM-${1000 + Math.floor(Math.random() * 9000)}`,
      customerId,
      createdAt: new Date().toISOString()
    };

    const updatedRemarks = [newRemark, ...curRemarks];
    localStorage.setItem(storageRemarksKey, JSON.stringify(updatedRemarks));

    triggerToast('Submited follow-up action remark successfully.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert stack overlay */}
      {toasts.length > 0 && (
        <div className="fixed top-5 right-5 z-55 flex flex-col gap-2.5 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border text-white ${
                t.type === 'success'
                  ? 'bg-emerald-600 border-emerald-500/30'
                  : 'bg-rose-600 border-rose-500/30'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {t.text}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-white/80 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Anchor element for smooth scrolling to form during editing */}
      <div id="collection-tab-forms-anchor" className="scroll-mt-10"></div>

      {/* Accordion List Container */}
      <div className="space-y-4">
        {(canCreateCollection || canUpdateCollection) && (
          <CollectionAccordion
            isOpen={activeSection === 'collection'}
            onToggle={() => handleToggleSection('collection')}
            onSave={handleSaveCollection}
            onCancel={handleCancelCollection}
            editingCollection={editingCollection}
          />
        )}

        {(canCreateCollection || canUpdateCollection) && (
          <RemarkAccordion
            isOpen={activeSection === 'remark'}
            onToggle={() => handleToggleSection('remark')}
            onSave={handleSaveRemark}
            onCancel={() => {}}
          />
        )}
      </div>

      {/* Real-time Collection Details List */}
      <CollectionDetailsTable
        collections={collections}
        onEdit={handleEditCollection}
        onDelete={handleDeleteCollection}
        isLoading={isLoading}
        canView={canViewCollection}
        canEdit={canUpdateCollection}
        canDelete={canDeleteCollection}
        canExport={canExportCollection}
      />
    </div>
  );
};
