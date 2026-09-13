import { useCallback, useEffect, useState } from 'react';
import { fetchPipelineRows, type PipelineRow, type PipelineStage } from '@/lib/pipelineApi';
import { toast } from '@/components/ui/toast';

export function usePipelineRows(stage: PipelineStage) {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchPipelineRows(stage)
      .then((data) => {
        setRows(data);
      })
      .catch(() => {
        setRows([]);
        toast({ title: 'Failed to load data', variant: 'error' });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [stage]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { rows, isLoading, refetch };
}
