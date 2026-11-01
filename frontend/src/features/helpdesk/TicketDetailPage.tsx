import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  CircleCheck,
  CirclePause,
  FileText,
  Link2,
  Lock,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  UserCog,
  XCircle,
} from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { textareaClassName } from '@/features/leads/components/leadDetailSectionShared';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  addTicketComment,
  fetchTicket,
  linkedRecordPath,
  startTicket,
  uploadTicketAttachment,
  TICKET_ATTACHMENT_ACCEPT,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_STATUS_LABELS,
  type TicketDetail,
} from '@/lib/helpdeskApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { TicketActionDialog, type TicketDialogAction } from './components/TicketActionDialog';
import { RaiseTicketDialog, type RaiseTicketPrefill } from './components/RaiseTicketDialog';
import { autoCloseHint, ticketPriorityBadgeClass, ticketStatusBadgeClass } from './ticketStyles';

const actionButtonClass = 'h-9 px-4 text-xs font-semibold rounded-md';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] pt-0.5">{label}</span>
      <span className="text-right font-semibold text-slate-700 dark:text-slate-200">{children}</span>
    </div>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const isAgent = hasPermission('ticket.resolve');
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogAction, setDialogAction] = useState<TicketDialogAction | null>(null);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  useTitle(ticket ? `${ticket.ticket_no} · Help Desk` : 'Ticket');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setTicket(await fetchTicket(id));
    } catch (err) {
      setTicket(null);
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const followUpPrefill = useMemo<RaiseTicketPrefill | undefined>(
    () =>
      ticket
        ? {
            department: ticket.department,
            linkedType: ticket.linked_type ?? undefined,
            linkedId: ticket.linked_object_id ?? undefined,
            linkedLabel: ticket.linked_label || undefined,
            referenceText: ticket.reference_text,
            relatedTicketId: ticket.id,
            relatedTicketNo: ticket.ticket_no,
          }
        : undefined,
    [ticket],
  );

  if (isLoading && !ticket) return <LoadingState message="Loading ticket…" />;
  if (!ticket) {
    return (
      <div className="space-y-4">
        <Breadcrumbs />
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {loadError || 'Ticket not found.'}
        </div>
      </div>
    );
  }

  const can = (action: string) => ticket.allowed_actions.includes(action as never);
  const isFinal = ticket.status === 'closed' || ticket.status === 'cancelled';
  const linkedPath = linkedRecordPath(ticket);
  const hint = ticket.status === 'resolved' ? autoCloseHint(ticket.auto_close_at) : null;
  const isRaiser = ticket.raised_by.id === currentUserId;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      setTicket(await startTicket(ticket.id));
    } catch (err) {
      toast({ title: 'Could not start', description: getApiErrorMessage(err), variant: 'error' });
    } finally {
      setIsStarting(false);
    }
  };

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setIsPosting(true);
    try {
      await addTicketComment(ticket.id, comment.trim(), isAgent && isInternal);
      setComment('');
      setIsInternal(false);
      await load();
    } catch (err) {
      toast({ title: 'Comment not added', description: getApiErrorMessage(err), variant: 'error' });
    } finally {
      setIsPosting(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > TICKET_ATTACHMENT_MAX_BYTES) {
      toast({ title: 'File too large', description: 'Max 5 MB.', variant: 'error' });
      return;
    }
    setIsUploading(true);
    try {
      await uploadTicketAttachment(ticket.id, file);
      await load();
    } catch (err) {
      toast({ title: 'Upload failed', description: getApiErrorMessage(err), variant: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumbs segmentLabels={{ [ticket.id]: ticket.ticket_no }} />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-black text-primary-deep tracking-tight">{ticket.ticket_no}</h1>
            <span className={ticketStatusBadgeClass(ticket.status)}>{ticket.status_display}</span>
            <span className={ticketPriorityBadgeClass(ticket.priority)}>{ticket.priority_display}</span>
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{ticket.subject}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={actionButtonClass} onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {can('start') && (
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={handleStart} disabled={isStarting}>
              <Play className="w-4 h-4 mr-1" /> {isStarting ? 'Starting…' : 'Start Work'}
            </Button>
          )}
          {can('assign') && (
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={() => setDialogAction('assign')}>
              <UserCog className="w-4 h-4 mr-1" /> Assign
            </Button>
          )}
          {can('hold') && (
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={() => setDialogAction('hold')}>
              <CirclePause className="w-4 h-4 mr-1" /> Hold
            </Button>
          )}
          {can('resolve') && (
            <Button
              size="sm"
              className={cn(actionButtonClass, 'bg-primary-deep hover:bg-secondary-dark')}
              onClick={() => setDialogAction('resolve')}
            >
              <CircleCheck className="w-4 h-4 mr-1" /> Resolve
            </Button>
          )}
          {can('cancel') && (
            <Button variant="outline" size="sm" className={cn(actionButtonClass, 'text-rose-600')} onClick={() => setDialogAction('cancel')}>
              <XCircle className="w-4 h-4 mr-1" /> Cancel Ticket
            </Button>
          )}
          {isRaiser && ticket.status === 'closed' && (
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={() => setFollowUpOpen(true)}>
              <RotateCcw className="w-4 h-4 mr-1" /> Raise Follow-up
            </Button>
          )}
        </div>
      </div>

      {ticket.status === 'resolved' && (
        <Card className="rounded-2xl border-violet-200 bg-violet-50/60 p-5 dark:border-violet-400/30 dark:bg-violet-500/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                Resolved by {ticket.resolved_by?.name ?? 'IT Support'} ·{' '}
                {formatAppDateTimeOrFallback(ticket.resolved_at)}
              </p>
              <p className="whitespace-pre-wrap text-sm font-semibold text-slate-800 dark:text-slate-100">
                {ticket.resolution_remark}
              </p>
              {hint && <p className="text-xs font-medium text-violet-600 dark:text-violet-300">{hint}</p>}
            </div>
            {(can('close') || can('reopen')) && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(actionButtonClass, 'text-rose-600')}
                  onClick={() => setDialogAction('reopen')}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Reopen
                </Button>
                <Button
                  size="sm"
                  className={cn(actionButtonClass, 'bg-emerald-600 hover:bg-emerald-700')}
                  onClick={() => setDialogAction('close')}
                >
                  <CircleCheck className="w-4 h-4 mr-1" /> Confirm & Close
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Issue</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{ticket.description}</p>
            {ticket.status === 'closed' && ticket.resolution_remark && (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Resolution</p>
                <p className="whitespace-pre-wrap text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {ticket.resolution_remark}
                </p>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Conversation</h2>
            {ticket.comments.length === 0 && (
              <p className="text-xs text-slate-400">No comments yet.</p>
            )}
            <ul className="space-y-3">
              {ticket.comments.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    'rounded-xl border px-4 py-3',
                    c.is_internal
                      ? 'border-amber-200 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-500/10'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {c.author.name}
                      {c.is_internal && (
                        <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                          <Lock className="h-3 w-3" /> Internal note
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">{formatAppDateTimeOrFallback(c.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">{c.body}</p>
                </li>
              ))}
            </ul>

            {can('comment') && (
              <form onSubmit={handleComment} className="space-y-2">
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isInternal ? 'Internal note for IT Support only…' : 'Write a comment…'}
                  className={textareaClassName}
                />
                <div className="flex items-center justify-between gap-2">
                  {isAgent ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Switch checked={isInternal} onCheckedChange={setIsInternal} />
                      Internal note (hidden from raiser)
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" size="sm" className={actionButtonClass} disabled={isPosting || !comment.trim()}>
                    <Send className="w-4 h-4 mr-1" /> {isPosting ? 'Posting…' : 'Post'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl p-5">
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Details</h2>
            <InfoRow label="Department">{ticket.department_display}</InfoRow>
            <InfoRow label="Category">{ticket.category.name}</InfoRow>
            <InfoRow label="Raised By">{ticket.raised_by.name}</InfoRow>
            <InfoRow label="Raised On">{formatAppDateTimeOrFallback(ticket.created_at)}</InfoRow>
            <InfoRow label="Assigned To">{ticket.assigned_to?.name ?? 'Unassigned'}</InfoRow>
            {ticket.reference_text && <InfoRow label="Reference">{ticket.reference_text}</InfoRow>}
            {ticket.linked_label && (
              <InfoRow label="Linked Record">
                {linkedPath ? (
                  <Link to={linkedPath} className="inline-flex items-center gap-1 text-primary-deep hover:underline">
                    <Link2 className="h-3 w-3" /> {ticket.linked_label}
                  </Link>
                ) : (
                  ticket.linked_label
                )}
              </InfoRow>
            )}
            {ticket.related_ticket && (
              <InfoRow label="Follow-up Of">
                <Link to={`/helpdesk/tickets/${ticket.related_ticket.id}`} className="text-primary-deep hover:underline">
                  {ticket.related_ticket.ticket_no}
                </Link>
              </InfoRow>
            )}
            {ticket.reopen_count > 0 && <InfoRow label="Reopened">{ticket.reopen_count}×</InfoRow>}
            {ticket.closed_at && (
              <InfoRow label={ticket.status === 'cancelled' ? 'Cancelled On' : 'Closed On'}>
                {formatAppDateTimeOrFallback(ticket.closed_at)}
                {ticket.close_type === 'auto' && <span className="block text-[10px] text-slate-400">Auto-closed</span>}
              </InfoRow>
            )}
          </Card>

          <Card className="rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Attachments</h2>
              {!isFinal && (
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary-deep hover:underline">
                  <Paperclip className="h-3.5 w-3.5" />
                  {isUploading ? 'Uploading…' : 'Add file'}
                  <input
                    type="file"
                    accept={TICKET_ATTACHMENT_ACCEPT}
                    className="hidden"
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>
            {ticket.attachments.length === 0 ? (
              <p className="text-xs text-slate-400">No files attached.</p>
            ) : (
              <ul className="space-y-2">
                {ticket.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate font-semibold text-slate-700 dark:text-slate-200">
                        {file.file_name}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatSize(file.file_size)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">History</h2>
            <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-800">
              {[...ticket.events].reverse().map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary-deep dark:border-slate-950" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {event.kind_display}
                    {event.from_status && event.from_status !== event.to_status && (
                      <span className="font-medium text-slate-400">
                        {' '}
                        · {TICKET_STATUS_LABELS[event.from_status]} → {TICKET_STATUS_LABELS[event.to_status]}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {event.actor?.name ?? 'System'} · {formatAppDateTimeOrFallback(event.created_at)}
                  </p>
                  {event.remark && (
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300">
                      {event.remark}
                    </p>
                  )}
                  {event.metadata?.corrections?.length ? (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                      {event.metadata.corrections.map((c, i) => (
                        <li key={i}>
                          <span className="font-semibold">{c.field}:</span> {c.before || '—'} → {c.after || '—'}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <TicketActionDialog
        ticket={ticket}
        action={dialogAction}
        onOpenChange={(open) => !open && setDialogAction(null)}
        onDone={(updated) => {
          setTicket(updated);
          toast({
            title: `${updated.ticket_no} · ${updated.status_display}`,
            variant: 'success',
          });
        }}
      />

      <RaiseTicketDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        prefill={followUpPrefill}
        onRaised={(created) => navigate(`/helpdesk/tickets/${created.id}`)}
      />
    </div>
  );
}
