import React, { useState, useMemo } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from 'lucide-react';
import { Collection } from './types';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DialogCloseIcon } from '@/components/ui/dialog';
import {
  RowActionButtonGroup,
  RowDeleteButton,
  RowEditButton,
  RowViewButton,
} from '@/components/ui/data-table-row-action-buttons';
import { collectionStatusBadgeClass } from '@/lib/badgeStyles';
import { cn, exportRowsToExcel, formatPersonName } from '@/lib/utils';
import { MODAL_OVERLAY_CLASS, MODAL_PANEL_CLASS } from '@/lib/uiTokens';
import { AppSelect } from '@/components/ui/app-select';
import { searchPlaceholder } from '@/lib/placeholders';
import {
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableHeadClass,
  dataTableSortableHeadClass,
  indexCellClass,
} from '@/components/ui/data-table';

interface CollectionDetailsTableProps {
  collections: Collection[];
  onEdit: (collection: Collection) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
}

export const CollectionDetailsTable: React.FC<CollectionDetailsTableProps> = ({
  collections,
  onEdit,
  onDelete,
  isLoading,
  canView = false,
  canEdit = false,
  canDelete = false,
  canExport = false,
}) => {
  // Search & Pagination States
  const [entriesCount, setEntriesCount] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Collection | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Detail View Modal State
  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null);

  useEscapeKey(Boolean(viewingCollection), () => setViewingCollection(null));

  // Delete Confirmation Modal State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Handle Sort Toggle
  const handleSort = (key: keyof Collection) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey('');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (key: keyof Collection) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={11} className="ml-1 inline opacity-40 hover:opacity-100" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp size={11} className="ml-1 inline text-primary-deep dark:text-lighter-gray font-bold" />;
    }
    return <ArrowDown size={11} className="ml-1 inline text-primary-deep dark:text-lighter-gray font-bold" />;
  };

  // Filter & Search Logic
  const filteredCollections = useMemo(() => {
    let result = [...collections];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(col => {
        return (
          col.transactionRefNo.toLowerCase().includes(query) ||
          col.collectedBy.toLowerCase().includes(query) ||
          col.bankName.toLowerCase().includes(query) ||
          col.remarks.toLowerCase().includes(query) ||
          col.collectionType.toLowerCase().includes(query) ||
          col.paymentMode.toLowerCase().includes(query) ||
          String(col.collectionAmount).includes(query)
        );
      });
    }

    // Sort logic
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        // String comparison
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [collections, searchQuery, sortKey, sortDirection]);

  // Pagination bounds
  const stats = useMemo(() => {
    const limit = parseInt(entriesCount, 10);
    const total = filteredCollections.length;
    const maxPage = Math.max(1, Math.ceil(total / limit));
    const activePage = Math.min(currentPage, maxPage);

    const startIdx = (activePage - 1) * limit;
    const endIdx = Math.min(startIdx + limit, total);
    const paginated = filteredCollections.slice(startIdx, endIdx);

    return {
      limit,
      total,
      maxPage,
      activePage,
      startIdx,
      endIdx,
      paginated
    };
  }, [filteredCollections, entriesCount, currentPage]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= stats.maxPage) {
      setCurrentPage(p);
    }
  };

  const handleCSVExport = () => {
    if (collections.length === 0) return;

    const headers = [
      '#ID', 'Date', 'Amount', 'Mode', 'Status', 'Ref No', 'Collected By', 'Bank Name', 'Deposit Date', 'Type', 'Bounce Charges', 'Remarks',
    ];

    const rows = collections.map((col, index) => [
      index + 1,
      col.collectionDate,
      col.collectionAmount,
      col.paymentMode,
      col.collectionStatus,
      col.transactionRefNo,
      col.collectedBy,
      col.bankName,
      col.depositDate,
      col.collectionType,
      col.bounceCharges,
      col.remarks,
    ]);

    exportRowsToExcel(headers, rows, `collections_export_${new Date().toISOString().slice(0, 10)}`, 'Collections');
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleDeleteExecute = () => {
    if (deletingId) {
      onDelete(deletingId);
      setDeletingId(null);
    }
  };

  const showRowActions = canView || canEdit || canDelete;
  const tableColSpan = showRowActions ? 10 : 9;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[14px] p-6 shadow-md shadow-slate-100/50 dark:shadow-none mt-6">

      {/* Title & Export Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4 gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            Collection Details
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Log, filter, and monitor customer collection sheets
          </p>
        </div>

        {canExport && (
          <button
            onClick={handleCSVExport}
            disabled={collections.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors text-xs font-bold text-slate-600 dark:text-slate-350 disabled:opacity-50 select-none cursor-pointer"
            title="Export CSV"
            type="button"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Show Entries & Search Filter Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 text-slate-500 dark:text-slate-400">
        {/* Show Entries */}
        <div className="flex items-center gap-2 text-[12px] sm:text-xs">
          <span>Show</span>
          <div className="relative">
            <AppSelect
              value={entriesCount}
              onValueChange={(value) => {
                setEntriesCount(value);
                setCurrentPage(1);
              }}
              options={['5', '10', '25']}
              triggerClassName="w-16"
            />
          </div>
          <span>entries</span>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 text-[12px] sm:text-xs">
          <span>Search:</span>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder('Ref No', 'Collected By', 'etc')}
              className="bg-transparent border border-slate-250 dark:border-slate-800 rounded px-2.5 py-1 text-slate-705 dark:text-slate-200 outline-none focus:border-primary-deep focus:ring-1 focus:ring-primary-deep w-48 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg border border-slate-150 dark:border-slate-800/80">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9fe] dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800">
            <tr>
              {[
                { label: '#', key: 'id' },
                { label: 'Collection Date', key: 'collectionDate' },
                { label: 'Amount', key: 'collectionAmount' },
                { label: 'Payment Mode', key: 'paymentMode' },
                { label: 'Transaction Ref', key: 'transactionRefNo' },
                { label: 'Collection Status', key: 'collectionStatus' },
                { label: 'Collected By', key: 'collectedBy' },
                { label: 'Deposit Date', key: 'depositDate' },
                { label: 'Remarks', key: 'remarks' },
                ...(showRowActions ? [{ label: 'Action', key: '' }] : []),
              ].map((col, idx) => {
                const canSort = col.key !== '';
                return (
                  <th
                    key={idx}
                    onClick={() => canSort && handleSort(col.key as keyof Collection)}
                    className={cn(
                      dataTableHeadClass,
                      'p-3 select-none',
                      canSort && dataTableSortableHeadClass,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{col.label}</span>
                      {canSort && getSortIcon(col.key as keyof Collection)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={tableColSpan} className="h-64 text-center">
                  <LoadingState layout="section" message="Loading collection registers…" className="py-12" />
                </td>
              </tr>
            ) : stats.paginated.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="p-8 text-center text-slate-400 dark:text-slate-400 font-medium text-[12px] tracking-wide">
                  No collection records available
                </td>
              </tr>
            ) : (
              stats.paginated.map((col, index) => {
                const absoluteIndex = stats.startIdx + index + 1;

                // Status badge styles
                const statusBadge = (
                  <Badge className={collectionStatusBadgeClass(col.collectionStatus)}>
                    {col.collectionStatus}
                  </Badge>
                );

                return (
                  <tr
                    key={col.id}
                    className={dataTableBodyRowClass}
                  >
                    <td className={indexCellClass}>
                      {absoluteIndex}
                    </td>

                    <td className={dataTableCellClass}>
                      {col.collectionDate || '-'}
                    </td>

                    <td className={cn(dataTableCellClass, 'text-right')}>
                      {col.collectionAmount}
                    </td>

                    <td className={dataTableCellClass}>
                      {col.paymentMode || '-'}
                    </td>

                    <td className={cn(dataTableCellClass, 'truncate max-w-[120px] select-all')} title={col.transactionRefNo}>
                      {col.transactionRefNo || '-'}
                    </td>

                    <td className={dataTableCellClass}>
                      {statusBadge}
                    </td>

                    <td className={dataTableCellClass}>
                      {formatPersonName(col.collectedBy) || '-'}
                    </td>

                    <td className={dataTableCellClass}>
                      {col.depositDate || '-'}
                    </td>

                    <td className={cn(dataTableCellClass, 'max-w-[150px] truncate italic')} title={col.remarks}>
                      {col.remarks || '-'}
                    </td>

                    {showRowActions && (
                    <td className={dataTableCellClass}>
                      <RowActionButtonGroup>
                        {canView && (
                          <RowViewButton
                            title="View Details"
                            aria-label="View collection details"
                            onClick={() => setViewingCollection(col)}
                          />
                        )}
                        {canEdit && (
                          <RowEditButton
                            title="Edit"
                            aria-label="Edit collection"
                            onClick={() => onEdit(col)}
                          />
                        )}
                        {canDelete && (
                          <RowDeleteButton
                            title="Delete"
                            aria-label="Delete collection"
                            onClick={() => confirmDelete(col.id)}
                          />
                        )}
                      </RowActionButtonGroup>
                    </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Stat Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5 text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
        <div>
          Showing {stats.total === 0 ? 0 : stats.startIdx + 1} to {stats.endIdx} of {stats.total} entries
          {searchQuery && ' (filtered)'}
        </div>

        {/* Pagination Buttons */}
        <div className="flex gap-px rounded border border-slate-200 dark:border-slate-800 text-[11px] font-bold select-none overflow-hidden">
          <button
            onClick={() => handlePageChange(stats.activePage - 1)}
            disabled={stats.activePage === 1}
            className={`px-3 py-1.5 ${
              stats.activePage === 1
                ? 'bg-slate-50 dark:bg-slate-950/50 text-slate-350 dark:text-slate-650 cursor-not-allowed'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
            }`}
            type="button"
          >
            Previous
          </button>

          <div className="w-px bg-slate-200 dark:bg-slate-800"></div>

          {Array.from({ length: stats.maxPage }, (_, idx) => {
            const pageNum = idx + 1;
            const isPageActive = pageNum === stats.activePage;
            return (
              <React.Fragment key={pageNum}>
                <button
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1.5 ${
                    isPageActive
                      ? 'bg-primary-deep text-white dark:bg-primary-deep/80'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                  }`}
                  type="button"
                >
                  {pageNum}
                </button>
                {pageNum < stats.maxPage && <div className="w-px bg-slate-200 dark:bg-slate-800"></div>}
              </React.Fragment>
            );
          })}

          <div className="w-px bg-slate-200 dark:bg-slate-800"></div>

          <button
            onClick={() => handlePageChange(stats.activePage + 1)}
            disabled={stats.activePage === stats.maxPage}
            className={`px-3 py-1.5 ${
              stats.activePage === stats.maxPage
                ? 'bg-slate-50 dark:bg-slate-950/50 text-slate-350 dark:text-slate-650 cursor-not-allowed'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
            }`}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {viewingCollection && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={cn(MODAL_PANEL_CLASS, 'max-w-lg animate-in zoom-in-95 duration-150 rounded-xl')}>
            {/* Header banner */}
            <div className="bg-primary-deep dark:bg-primary-deep/80 py-3 px-5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Collection Receipt Audit</span>
              <button
                onClick={() => setViewingCollection(null)}
                className="rounded-full p-0.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                type="button"
              >
                <DialogCloseIcon className="text-white/80" />
              </button>
            </div>

            <div className="p-5 text-xs text-slate-705 dark:text-slate-300 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Receipt No</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingCollection.receiptNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Reference No</p>
                  <p className="font-mono text-slate-800 dark:text-white text-xs">{viewingCollection.transactionRefNo || 'N/A'}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Collected Amount</p>
                  <p className="font-bold text-[#c2410c] dark:text-amber-400 text-xs">{viewingCollection.collectionAmount}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Payment Mode</p>
                  <p className="font-medium text-slate-800 dark:text-white text-xs">{viewingCollection.paymentMode}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Date of Collection</p>
                  <p className="font-mono font-medium text-slate-800 dark:text-white text-xs">{viewingCollection.collectionDate}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Date of Bank Deposit</p>
                  <p className="font-mono font-medium text-slate-800 dark:text-white text-xs">{viewingCollection.depositDate || 'N/A'}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Collection Status</p>
                  <span className={`inline-block font-bold text-[10px] uppercase px-2 py-0.5 rounded mt-0.5 ${
                    viewingCollection.collectionStatus === 'Received'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30'
                      : viewingCollection.collectionStatus === 'Failed'
                        ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400'
                        : 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                  }`}>
                    {viewingCollection.collectionStatus}
                  </span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">LMS Officer Account</p>
                  <p className="font-medium text-slate-800 dark:text-white text-xs">{viewingCollection.collectedBy || 'N/A'}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 col-span-2">
                  <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Bounce Charges Applied</p>
                  <p className="font-mono text-slate-800 dark:text-white text-xs">{viewingCollection.bounceCharges}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                <p className="text-slate-400 font-bold mb-0.5 text-[10px] uppercase">Audit Remarks & Feedback</p>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap leading-relaxed">
                  {viewingCollection.remarks || 'No remarks provided.'}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 py-3 px-5 flex items-center justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setViewingCollection(null)}
                className="px-4 py-1.5 rounded-lg bg-primary-deep hover:bg-secondary-dark transition-colors text-xs font-semibold text-white cursor-pointer"
                type="button"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteDialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Confirm record deletion"
        description="Are you sure you want to delete this collection entry? This operation is irreversible and will remove the balance log from current ledger reports."
        confirmLabel="Confirm Delete"
        onConfirm={handleDeleteExecute}
      />

    </div>
  );
};
