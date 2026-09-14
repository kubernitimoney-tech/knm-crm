import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav } from '@/components/ui/responsive-tabs-nav';
import { GridDetailTable } from '@/features/leads/components/leadDetailSectionShared';
import { fetchLeadVideoKycRequestDetail, type ApiLeadVideoKycDetail } from '@/lib/leadDetailsApi';
import { badgeClass } from '@/lib/badgeStyles';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

function IdFoundBadge({ label, found }: { label: string; found: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        found
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500',
      )}
    >
      {label}
    </span>
  );
}

function detailRows(record: Record<string, string>) {
  return Object.entries(record).map(([key, value]) => ({
    label: key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    value: value || '—',
  }));
}

const VIDEO_KYC_TAB_ITEMS = [
  { value: 'video', label: 'Selfie / Video' },
  { value: 'aadhaar', label: 'Aadhar Details' },
  { value: 'pan', label: 'Pancard Details' },
] as const;

function VideoKycPlayer({ src }: { src: string | null }) {
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    setPlaybackError(false);
  }, [src]);

  if (!src) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <p className="text-xs text-slate-400 font-medium text-center px-4">
          No video recording was returned for this workflow.
        </p>
      </div>
    );
  }

  if (playbackError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-4">
        <p className="text-xs text-slate-500 font-medium text-center">
          This recording cannot be played here. Download the file or open it in Chrome.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-bold text-primary-deep underline"
        >
          Open recording
        </a>
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-black max-h-[320px]"
      onError={() => setPlaybackError(true)}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

function SelfiePreview({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40">
        <p className="px-4 text-center text-xs font-medium text-slate-400">
          No selfie image has been returned yet.
        </p>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Customer selfie captured during KYC"
      className="max-h-[320px] w-full rounded-lg border border-slate-200 bg-black object-contain dark:border-slate-800"
    />
  );
}

export function VideoKycDetailPage() {
  const { leadId, requestId } = useParams<{ leadId: string; requestId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ApiLeadVideoKycDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<string>(VIDEO_KYC_TAB_ITEMS[0].value);

  useTitle(detail ? `Video KYC · ${detail.customer_name}` : 'Video KYC Details');

  const loadDetail = useCallback(async () => {
    if (!leadId || !requestId) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchLeadVideoKycRequestDetail(leadId, requestId);
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load video KYC details.');
      toast({ title: 'Failed to load video KYC details', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [leadId, requestId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return <LoadingState layout="page" message="Loading video KYC details…" />;
  }

  if (!detail || loadError) {
    return (
      <div className="space-y-4">
        <Breadcrumbs />
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-rose-600">{loadError || 'Video KYC request not found.'}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate(leadId ? `/leads/all/${leadId}` : '/leads/all')}
          >
            Back to Lead
          </Button>
        </Card>
      </div>
    );
  }

  const {
    geolocation,
    recording_file_url: recordingUrl,
    selfie_file_url: selfieUrl,
  } = detail.video_details;
  const hasCoordinates = geolocation.latitude != null && geolocation.longitude != null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Breadcrumbs />
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 shrink-0"
              onClick={() => navigate(`/leads/all/${leadId}`)}
              title="Back to lead"
            >
              <ChevronLeft size={16} />
            </Button>
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">Video KYC Details</h1>
          </div>
        </div>
      </div>

      <Card className="p-5 border-slate-150 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8 text-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Request ID</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200 break-all">{detail.id}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customer Name</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{detail.customer_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email ID</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{detail.customer_email}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
            <Badge
              className={badgeClass(
                detail.approval_status === 'Approved' ? 'success' : 'neutral',
              )}
            >
              {detail.approval_status}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ID&apos;s Found</p>
            <div className="flex flex-wrap gap-1.5">
              <IdFoundBadge label="Video" found={detail.ids_found.video} />
              <IdFoundBadge label="Selfie" found={detail.ids_found.selfie} />
              <IdFoundBadge label="Aadhaar" found={detail.ids_found.aadhaar} />
              <IdFoundBadge label="PAN" found={detail.ids_found.pan} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date &amp; Time</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{formatAppDateTimeOrFallback(detail.date_time)}</p>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ResponsiveTabsNav
          items={VIDEO_KYC_TAB_ITEMS}
          value={activeTab}
          onValueChange={setActiveTab}
        />

        <TabsContent value="video" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-4 border-slate-150 dark:border-slate-800 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin size={12} />
                Video Geolocation
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Latitude</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {geolocation.latitude ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Longitude</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {geolocation.longitude ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400 font-medium shrink-0">Address</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-right">
                    {geolocation.address || '—'}
                  </span>
                </div>
                {hasCoordinates ? (
                  <a
                    href={`https://www.google.com/maps?q=${geolocation.latitude},${geolocation.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex pt-1 text-[11px] font-bold text-primary-deep underline"
                  >
                    Open in Maps
                  </a>
                ) : null}
              </div>
            </Card>

            <Card className="p-4 border-slate-150 dark:border-slate-800 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selfie</p>
              <SelfiePreview src={selfieUrl} />
            </Card>

            <Card className="p-4 border-slate-150 dark:border-slate-800 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Video Player</p>
              <VideoKycPlayer src={recordingUrl} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aadhaar" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
          <GridDetailTable items={detailRows(detail.aadhaar_details)} columnsPerRow={3} />
        </TabsContent>

        <TabsContent value="pan" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
          <GridDetailTable items={detailRows(detail.pan_details)} columnsPerRow={3} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
