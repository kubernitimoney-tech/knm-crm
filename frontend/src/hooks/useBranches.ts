import { useCallback, useEffect, useState } from 'react';
import { fetchBranches, resolveBranchName, type ApiBranch } from '@/lib/branchesApi';

export function useBranches() {
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBranches();
      setBranches(data);
    } catch (err) {
      setBranches([]);
      setError(err instanceof Error ? err.message : 'Failed to load branches.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const pickBranchName = useCallback(
    (preferred?: string | null) => resolveBranchName(branches, preferred),
    [branches],
  );

  return {
    branches,
    isLoading,
    error,
    reload: loadBranches,
    pickBranchName,
  };
}
