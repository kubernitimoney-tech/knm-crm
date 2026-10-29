import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { dataTableCellClass, dataTableHeadClass } from '@/components/ui/data-table';

export const FORM_TRANSITION_MS = 320;

export const STATUS_OPTIONS = ['verified', 'unverified', 'incomplete'] as const;
export const BINARY_STATUS_OPTIONS = ['verified', 'unverified'] as const;
export type EntryStatus = (typeof STATUS_OPTIONS)[number];
export type BinaryEntryStatus = (typeof BINARY_STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<EntryStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  incomplete: 'Incomplete',
};

export function entryStatusLabel(status: EntryStatus): string {
  return STATUS_LABELS[status];
}

export function binaryStatusOptions() {
  return BINARY_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: entryStatusLabel(status),
  }));
}

export function useAnimatedFormPanel() {
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const openForm = useCallback((onOpen?: () => void) => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    onOpen?.();
    setFormError(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback((onAfterClose?: () => void) => {
    setShowForm(false);
    afterCloseRef.current = onAfterClose ?? null;
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      afterCloseRef.current?.();
      afterCloseRef.current = null;
      resetTimeoutRef.current = null;
    }, FORM_TRANSITION_MS);
  }, []);

  return { showForm, formError, setFormError, openForm, closeForm };
}

export const sectionCellClassName = dataTableCellClass;

export function sectionHeadClassName(extra?: string) {
  return cn(dataTableHeadClass, 'py-3', extra);
}
