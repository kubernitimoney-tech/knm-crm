import React, { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  fetchLeadVideoKycRequests,
  sendLeadVideoKycRequest,
  type ApiLeadVideoKycRequest,
} from '@/lib/leadDetailsApi';
import { esignRequestStatusDisplay } from '@/lib/badgeStyles';
import { formatPersonName } from '@/lib/utils';
import {
  EmptyTableRow,
  SectionTable,
  sectionHeadClassName,
  sectionCellClassName,
} from '@/features/leads/components/leadDetailSectionShared';

export type VideoKycRequestStatus = ApiLeadVideoKycRequest['status'];

export interface LeadVideoKycEntry {
  id: string;
  status: VideoKycRequestStatus;
  requestedBy: string;
  videoLabel: string;
  requestedOn: string;
  signedOn: string;
  recordingFileUrl: string | null;
  selfieFileUrl: string | null;
}

interface LeadVideoKycDetailsSectionProps {
  leadId: string;
  customerEmail?: string;
  canSendRequest?: boolean;
  refreshToken?: number;
}

function mapApiEntry(entry: ApiLeadVideoKycRequest): LeadVideoKycEntry {
  return {
    id: entry.id,
    status: entry.status,
    requestedBy: entry.requested_by_name,
    videoLabel: entry.video,
    requestedOn: entry.requested_on,
    signedOn: entry.signed_on,
    recordingFileUrl: entry.recording_file_url,
    selfieFileUrl: entry.selfie_file_url,
  };
}

export function LeadVideoKycDetailsSection({
  leadId,
  customerEmail,
  canSendRequest = false,
  refreshToken = 0,
}: LeadVideoKycDetailsSectionProps) {
  const { hasPermission } = usePermissions();
  const canViewDocument = hasPermission('document.view');
  const canDownloadDocument = hasPermission('document.download');
  const [entries, setEntries] = useState<LeadVideoKycEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMethodDialogOpen, setIsMethodDialogOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadVideoKycRequests(leadId);
      setEntries(data.map(mapApiEntry));
    } catch (err) {
      toast({
        title: 'Failed to load video KYC requests',
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

  const handleSendRequest = async (verificationMethod: 'email' | 'mobile') => {
    setIsSending(true);
    try {
      const created = await sendLeadVideoKycRequest(leadId, verificationMethod);
      setEntries((prev) => [mapApiEntry(created), ...prev]);
      setIsMethodDialogOpen(false);
      toast({
        title: 'Video KYC request sent',
        description: created.email_sent && customerEmail
          ? `Video KYC link emailed to ${customerEmail}.`
          : 'Video KYC was created, but the email could not be sent. Use Open to share the link.',
        variant: created.email_sent ? 'success' : 'error',
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
          Uses the “AadharPAN with selfie and OCR” DigiStudio workflow to collect DigiLocker
          identity data, selfie/video and OCR results.
        </p>
        {canSendRequest ? (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg border-slate-200 shrink-0"
            onClick={() => setIsMethodDialogOpen(true)}
            disabled={isSending}
            title="Request Video KYC"
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
            <TableHead className={sectionHeadClassName()}>Video</TableHead>
            <TableHead className={sectionHeadClassName()}>Requested On</TableHead>
            <TableHead className={sectionHeadClassName()}>Signed On</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingRow colSpan={5} message="Loading video KYC requests…" compact />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={5} message="No video KYC requests sent yet." />
          ) : (
            entries.map((entry) => {
              const statusDisplay = esignRequestStatusDisplay(entry.status);
              const canOpenKycSession =
                entry.status !== 'completed' &&
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
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canOpenKycSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold rounded-md"
                        title="Open Digio Aadhaar, PAN and selfie KYC session"
                        onClick={() => {
                          window.open(`/verify-kyc/${entry.id}`, '_blank', 'noopener,noreferrer');
                          toast({
                            title: 'KYC workflow opened',
                            description: 'Complete the Aadhaar, PAN, selfie and OCR steps in Digio.',
                            variant: 'success',
                          });
                        }}
                      >
                        <ExternalLink size={12} className="mr-1" />
                        Open
                      </Button>
                    )}
                    {canViewDocument && (
                      <RowViewButton
                        title="View video KYC details"
                        aria-label="View video KYC details"
                        to={`/leads/all/${leadId}/video-kyc/${entry.id}`}
                      />
                    )}
                    {canDownloadDocument && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold rounded-md"
                        disabled={
                          entry.status !== 'completed' ||
                          (!entry.recordingFileUrl && !entry.selfieFileUrl)
                        }
                        onClick={() => {
                          const mediaUrl = entry.recordingFileUrl || entry.selfieFileUrl;
                          if (mediaUrl) {
                            window.open(mediaUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <Download size={12} className="mr-1" />
                        Download
                      </Button>
                    )}
                    {!canOpenKycSession && !canViewDocument && !canDownloadDocument && (
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
      <Dialog open={isMethodDialogOpen} onOpenChange={setIsMethodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose initial verification code</DialogTitle>
            <DialogDescription>
              Digio will verify the customer with this code before starting the KYC workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              onClick={() => void handleSendRequest('mobile')}
              disabled={isSending}
            >
              Send code to mobile number
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSendRequest('email')}
              disabled={isSending}
            >
              Send code to email address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
