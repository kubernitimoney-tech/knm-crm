import React, { useEffect, useRef } from 'react';
import { AppSelect } from '@/components/ui/app-select';
import { useBranches } from '@/hooks/useBranches';
import { cn } from '@/lib/utils';
import { selectPlaceholder } from '@/lib/placeholders';

interface BranchSelectProps {
  value: string;
  onChange: (branchName: string) => void;
  preferredBranch?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function BranchSelect({
  value,
  onChange,
  preferredBranch,
  className,
  disabled = false,
  required = false,
  placeholder = selectPlaceholder('Branch'),
}: BranchSelectProps) {
  const { branches, isLoading, error, pickBranchName } = useBranches();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!branches.length || syncedRef.current) return;
    if (!preferredBranch && !value) {
      syncedRef.current = true;
      return;
    }
    const resolved = pickBranchName(preferredBranch || value);
    if (resolved) {
      onChange(resolved);
    }
    syncedRef.current = true;
  }, [branches, onChange, pickBranchName, preferredBranch, value]);

  useEffect(() => {
    syncedRef.current = false;
  }, [preferredBranch]);

  if (isLoading) {
    return (
      <AppSelect
        value=""
        onValueChange={() => {}}
        placeholder="Loading branches..."
        options={[]}
        triggerClassName={className}
        disabled
      />
    );
  }

  if (error || branches.length === 0) {
    return (
      <AppSelect
        value=""
        onValueChange={() => {}}
        placeholder={error ?? 'No branches available'}
        options={[]}
        triggerClassName={className}
        disabled
      />
    );
  }

  const selectedValue =
    value && branches.some((branch) => branch.branch_name === value)
      ? value
      : preferredBranch
        ? pickBranchName(preferredBranch) ?? ''
        : '';

  return (
    <AppSelect
      value={selectedValue}
      onValueChange={onChange}
      placeholder={placeholder}
      options={branches.map((branch) => ({
        value: branch.branch_name,
        label: branch.branch_name,
      }))}
      triggerClassName={cn(className, required && !selectedValue && 'aria-invalid')}
      disabled={disabled}
      elevated
    />
  );
}
