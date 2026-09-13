import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from '@/components/ui/toast';
import {
  downloadAuthenticatedFile,
  fetchAuthenticatedFileBlob,
  fetchLeadDocuments,
  getLeadDocumentDownloadUrl,
} from '@/lib/leadDetailsApi';
import { leadDetailsPath } from '@/lib/leadNavigation';

function isInlinePreviewType(contentType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (contentType.startsWith('image/') || contentType === 'application/pdf') {
    return true;
  }
  return /\.(pdf|png|jpe?g|gif|webp|bmp|svg)$/i.test(lower);
}

export function LeadDocumentViewPage() {
  const { leadId, documentId } = useParams<{ leadId: string; documentId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canDownload = hasPermission('document.download');
  const [fileName, setFileName] = useState('Document');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useTitle(fileName);

  const loadDocument = useCallback(async () => {
    if (!leadId || !documentId) return;
    setIsLoading(true);
    setLoadError('');
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    try {
      const documents = await fetchLeadDocuments(leadId);
      const document = documents.find((item) => item.id === documentId);
      const resolvedName = document?.file_name || 'Document';
      setFileName(resolvedName);

      const blob = await fetchAuthenticatedFileBlob(
        getLeadDocumentDownloadUrl(leadId, documentId),
      );
      setContentType(blob.type || 'application/octet-stream');
      setObjectUrl(URL.createObjectURL(blob));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load document.');
      toast({ title: 'Failed to load document', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [leadId, documentId]);

  useEffect(() => {
    loadDocument();
    return () => {
      setObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [loadDocument]);

  const handleDownload = async () => {
    if (!leadId || !documentId) return;
    try {
      await downloadAuthenticatedFile(
        getLeadDocumentDownloadUrl(leadId, documentId),
        fileName,
      );
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return <LoadingState layout="page" message="Loading document…" />;
  }

  if (loadError || !objectUrl) {
    return (
      <div className="space-y-4 p-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-bold"
          onClick={() => navigate(leadDetailsPath(leadId ?? ''))}
        >
          <ChevronLeft size={14} className="mr-1" />
          Back to lead
        </Button>
        <p className="text-sm text-rose-500">{loadError || 'Document unavailable.'}</p>
      </div>
    );
  }

  const canPreviewInline = isInlinePreviewType(contentType, fileName);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-bold"
          onClick={() => navigate(leadDetailsPath(leadId ?? ''))}
        >
          <ChevronLeft size={14} className="mr-1" />
          Back to lead
        </Button>
        <div className="flex items-center gap-2">
          <p className="max-w-[40vw] truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
            {fileName}
          </p>
          {canDownload && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-bold"
              onClick={handleDownload}
            >
              <Download size={14} className="mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>

      {canPreviewInline ? (
        contentType.startsWith('image/') ? (
          <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <img src={objectUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <iframe
            title={fileName}
            src={objectUrl}
            className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Preview is not available for this file type.
          </p>
          <Button size="sm" onClick={handleDownload}>
            <Download size={14} className="mr-1" />
            Download {fileName}
          </Button>
        </div>
      )}
    </div>
  );
}
