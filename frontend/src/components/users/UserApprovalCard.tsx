import { useState, type ReactNode } from 'react';
import { CheckCircle2, FileText, Paperclip, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import { toast } from '@/components/ui/toast';
import { badgeClass } from '@/lib/badgeStyles';
import { formatAppDateTimeOrFallback } from '@/lib/dateUtils';
import { getApiErrorMessage } from '@/lib/api';
import {
  APPROVAL_ATTACHMENT_ACCEPT,
  validateApprovalAttachment,
} from '@/lib/approvalAttachment';
import {
  approveUser,
  rejectUser,
  resubmitUserApproval,
  type ApiUser,
  type UserApprovalStatus,
} from '@/lib/usersApi';

const STATUS_TONE: Record<UserApprovalStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const TEXTAREA_CLASS =
  'w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-deep/10 resize-none';

interface UserApprovalCardProps {
  user: ApiUser;
  currentUserId: string | undefined;
  canApprove: boolean;
  canResubmit: boolean;
  onChanged: (user: ApiUser) => void;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="text-sm font-semibold text-slate-700 break-words">{children}</div>
    </div>
  );
}

export const UserApprovalCard = ({
  user,
  currentUserId,
  canApprove,
  canResubmit,
  onChanged,
}: UserApprovalCardProps) => {
  const approval = user.approval;
  const [remarks, setRemarks] = useState('');
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitRemarks, setResubmitRemarks] = useState(approval?.request_remarks ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'resubmit' | null>(null);
  const [error, setError] = useState('');

  if (!approval) return null;

  const isPending = approval.status === 'pending';
  const isRequester = approval.created_by !== null && approval.created_by === currentUserId;
  const isSelf = user.id === currentUserId;
  const showDecision = isPending && canApprove;
  const decisionBlockedReason = isSelf
    ? 'You cannot review your own account.'
    : isRequester
      ? 'You submitted this request, so another approver must review it.'
      : '';

  const run = async (kind: 'approve' | 'reject' | 'resubmit', action: () => Promise<ApiUser>, message: string) => {
    setError('');
    setBusy(kind);
    try {
      const updated = await action();
      toast({ title: message, variant: 'success' });
      setRemarks('');
      setResubmitFile(null);
      onChanged(updated);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      setError('Remarks are required when rejecting a request.');
      return;
    }
    void run('reject', () => rejectUser(user.id, remarks.trim()), 'Request rejected');
  };

  const handleResubmit = () => {
    if (!resubmitFile) {
      setError('Upload the updated approval mail or document.');
      return;
    }
    const fileError = validateApprovalAttachment(resubmitFile);
    if (fileError) {
      setError(fileError);
      return;
    }
    if (resubmitRemarks.trim().length < 10) {
      setError('Request remarks must be at least 10 characters.');
      return;
    }
    void run(
      'resubmit',
      () => resubmitUserApproval(user.id, resubmitFile, resubmitRemarks.trim()),
      'Request resubmitted for approval',
    );
  };

  return (
    <Card className="p-8 border-slate-100 shadow-xl shadow-slate-200/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-deep/5 text-primary-deep flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-primary-deep">User Approval</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {isPending
                ? 'Login stays disabled until this request is approved.'
                : 'Maker-checker record for this account.'}
            </p>
          </div>
        </div>
        <Badge className={badgeClass(STATUS_TONE[approval.status], 'px-3 py-1')}>
          {approval.status === 'pending' ? 'Pending Approval' : approval.status_display}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Detail label="Request Remarks">{approval.request_remarks || '—'}</Detail>
        <Detail label="Attachment">
          {approval.attachment_url ? (
            <a
              href={approval.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-deep hover:underline"
            >
              <Paperclip size={14} />
              {approval.attachment_name || 'View attachment'}
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 text-slate-400">
              <FileText size={14} />
              {approval.attachment_name || 'No attachment (existing user)'}
            </span>
          )}
        </Detail>
        <Detail label="Requested By">
          {approval.created_by_name ?? 'System'} · {formatAppDateTimeOrFallback(approval.created_at)}
        </Detail>
        {approval.approved_at ? (
          <Detail label={approval.status === 'rejected' ? 'Rejected By' : 'Approved By'}>
            {approval.approved_by_name ?? 'System'} · {formatAppDateTimeOrFallback(approval.approved_at)}
          </Detail>
        ) : null}
        {approval.approver_remarks ? (
          <Detail label="Approver Remarks">{approval.approver_remarks}</Detail>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      {showDecision ? (
        decisionBlockedReason ? (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] text-slate-500 font-semibold">
            {decisionBlockedReason}
          </div>
        ) : (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            <FieldLabel variant="dialog">Approver Remarks (required to reject)</FieldLabel>
            <textarea
              rows={2}
              maxLength={2000}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={TEXTAREA_CLASS}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={handleReject}
                className="h-11 rounded-xl text-xs font-bold gap-2 border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <XCircle size={16} />
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('approve', () => approveUser(user.id, remarks.trim()), 'User approved and activated')}
                className="h-11 rounded-xl text-xs font-bold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <CheckCircle2 size={16} />
                {busy === 'approve' ? 'Approving…' : 'Approve & Activate'}
              </Button>
            </div>
          </div>
        )
      ) : null}

      {approval.status === 'rejected' && canResubmit ? (
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
          <FieldLabel variant="dialog" required>Updated Approval Attachment</FieldLabel>
          <div className="relative">
            <Paperclip className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              type="file"
              accept={APPROVAL_ATTACHMENT_ACCEPT}
              onChange={(e) => setResubmitFile(e.target.files?.[0] ?? null)}
              className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary-deep file:text-white"
            />
          </div>
          <FieldLabel variant="dialog" required>Request Remarks</FieldLabel>
          <textarea
            rows={3}
            maxLength={2000}
            value={resubmitRemarks}
            onChange={(e) => setResubmitRemarks(e.target.value)}
            className={TEXTAREA_CLASS}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={busy !== null}
              onClick={handleResubmit}
              className="h-11 rounded-xl text-xs font-bold gap-2 bg-primary-deep text-white"
            >
              <RotateCcw size={16} />
              {busy === 'resubmit' ? 'Resubmitting…' : 'Resubmit for Approval'}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
