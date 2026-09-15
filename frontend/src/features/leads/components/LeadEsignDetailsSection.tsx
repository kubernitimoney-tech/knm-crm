import React, { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RowViewButton } from '@/components/ui/data-table-row-action-buttons';
import { Badge } from '@/components/ui/badge';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchLeadEsignRequests,
  sendLeadEsignRequest,
  type ApiLeadEsignRequest,
} from '@/lib/leadDetailsApi';
import { esignRequestStatusDisplay } from '@/lib/badgeStyles';
import { formatPersonName } from '@/lib/utils';
import {
  EmptyTableRow,
  SectionTable,
  sectionHeadClassName,
  sectionCellClassName,
} from '@/features/leads/components/leadDetailSectionShared';

export type EsignRequestStatus = ApiLeadEsignRequest['status'];

export interface LeadEsignEntry {
  id: string;
  status: EsignRequestStatus;
  requestedBy: string;
  documents: string;
  requestedOn: string;
  signedOn: string;
  signedFileUrl: string | null;
  reviewUrl: string | null;
  signType: ApiLeadEsignRequest['sign_type'];
}

interface LeadEsignDetailsSectionProps {
  leadId: string;
  customerEmail?: string;
  canSendRequest?: boolean;
  refreshToken?: number;
}

function mapApiEntry(entry: ApiLeadEsignRequest): LeadEsignEntry {
  return {
    id: entry.id,
    status: entry.status,
    requestedBy: entry.requested_by_name,
    documents: entry.documents,
    requestedOn: entry.requested_on,
    signedOn: entry.signed_on,
    signedFileUrl: entry.signed_file_url,
    reviewUrl: entry.review_url || null,
    signType: entry.sign_type,
  };
}

export function LeadEsignDetailsSection({
  leadId,
  customerEmail,
  canSendRequest = false,
  refreshToken = 0,
}: LeadEsignDetailsSectionProps) {
  const { hasPermission } = usePermissions();
  const canViewDocument = hasPermission('document.view');
  const canDownloadDocument = hasPermission('document.download');
  const [entries, setEntries] = useState<LeadEsignEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadEsignRequests(leadId);
      setEntries(data.map(mapApiEntry));
    } catch (err) {
      toast({
        title: 'Failed to load e-sign requests',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [leadId, refreshToken]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSendRequest = async () => {
    setIsSending(true);
    try {
      const created = await sendLeadEsignRequest(leadId);
      setEntries((prev) => [mapApiEntry(created), ...prev]);
      toast({
        title: 'E-sign request sent',
        description: customerEmail
          ? `Signing link emailed to ${customerEmail}. Customer previews Agreement.pdf, then signs with Aadhaar OTP on the Aadhaar-linked mobile.`
          : 'Signing link created. Customer previews Agreement.pdf, then signs with Aadhaar OTP on the Aadhaar-linked mobile.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Customer previews Agreement.pdf on our page, then enters Aadhaar or VID and OTP. No drawn
          signature is required.
        </p>
        {canSendRequest ? (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg border-slate-200 shrink-0"
            onClick={() => void handleSendRequest()}
            disabled={isSending}
            title="Request E-Sign"
          >
            <Mail size={15} className="text-primary-deep" />
          </Button>
        ) : null}
      </div>

      <SectionTable>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className={sectionHeadClassName()}>Status</TableHead>
            <TableHead className={sectionHeadClassName()}>Requested By</TableHead>
            <TableHead className={sectionHeadClassName()}>Method</TableHead>
            <TableHead className={sectionHeadClassName()}>Documents</TableHead>
            <TableHead className={sectionHeadClassName()}>Requested On</TableHead>
            <TableHead className={sectionHeadClassName()}>Signed On</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingRow colSpan={6} message="Loading e-sign requests…" compact />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={6} message="No e-sign requests sent yet." />
          ) : (
            entries.map((entry) => {
              const statusDisplay = esignRequestStatusDisplay(entry.status);
              const canOpenSigningLink =
                Boolean(entry.reviewUrl) &&
                entry.status !== 'signed' &&
                entry.status !== 'expired';
              return (
              <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
                <TableCell>
                  <Badge className={statusDisplay.className}>
                    {statusDisplay.label}
                  </Badge>
                </TableCell>
                <TableCell className={sectionCellClassName}>
                  {formatPersonName(entry.requestedBy)}
                </TableCell>
                <TableCell className={sectionCellClassName}>
                  {entry.signType === 'aadhaar' ? 'Aadhaar / VID OTP' : 'Email OTP'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canOpenSigningLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold rounded-md"
                        title="Open document review, then Aadhaar/VID OTP"
                        onClick={() => {
                          if (entry.reviewUrl) {
                            window.open(entry.reviewUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <ExternalLink size={12} className="mr-1" />
                        Open
                      </Button>
                    )}
                    {canViewDocument && (
                      <RowViewButton
                        title="View"
                        aria-label="View signed document"
                        disabled={entry.status !== 'signed' || !entry.signedFileUrl}
                        href={entry.signedFileUrl}
                      />
                    )}
                    {canDownloadDocument && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold rounded-md"
                        disabled={entry.status !== 'signed' || !entry.signedFileUrl}
                        onClick={() => {
                          if (entry.signedFileUrl) {
                            window.open(entry.signedFileUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <Download size={12} className="mr-1" />
                        Download
                      </Button>
                    )}
                    {!canOpenSigningLink && !canViewDocument && !canDownloadDocument && (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={sectionCellClassName}>
                  {entry.requestedOn}
                </TableCell>
                <TableCell className={sectionCellClassName}>
                  {entry.signedOn}
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </SectionTable>
    </div>
  );
}
