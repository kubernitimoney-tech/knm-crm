import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Bell, CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/pipelineApi';

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}

interface NotificationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDialog = ({
  isOpen,
  onOpenChange,
  onUnreadCountChange,
}: NotificationDialogProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const syncUnreadCount = useCallback(
    (items: Notification[]) => {
      onUnreadCountChange?.(items.filter((n) => !n.read).length);
    },
    [onUnreadCountChange],
  );

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { notifications: items, unread_count } = await fetchNotifications();
      const mapped = items.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.body,
        time: formatDistanceToNow(new Date(n.created_at), { addSuffix: true }),
        type: 'info' as const,
        read: n.is_read,
      }));
      setNotifications(mapped);
      onUnreadCountChange?.(unread_count);
    } catch {
      setNotifications([]);
      onUnreadCountChange?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (!isOpen) return;
    void loadNotifications();
  }, [isOpen, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read || markingId) return;

    setMarkingId(id);
    try {
      await markNotificationRead(id);
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        syncUnreadCount(next);
        return next;
      });
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => {
        const next = prev.map((n) => ({ ...n, read: true }));
        syncUnreadCount(next);
        return next;
      });
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-slate-200 rounded-3xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-primary-deep">
                <Bell size={20} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Center Notifications</DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Stay updated with system activity
                </DialogDescription>
              </div>
            </div>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
                {unreadCount} New
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[450px] overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium italic">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium italic">No notifications yet</div>
          ) : null}
          {notifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              disabled={notif.read || markingId === notif.id}
              onClick={() => void handleMarkRead(notif.id)}
              className={cn(
                'w-full text-left p-4 rounded-2xl transition-all group hover:bg-slate-50 border border-transparent hover:border-slate-100 flex gap-4',
                !notif.read && 'bg-primary-deep/[0.02] cursor-pointer',
                notif.read && 'cursor-default',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                notif.type === 'success' && 'bg-emerald-50 text-emerald-600',
                notif.type === 'warning' && 'bg-amber-50 text-amber-600',
                notif.type === 'error' && 'bg-rose-50 text-rose-600',
                notif.type === 'info' && 'bg-blue-50 text-blue-600',
              )}>
                {notif.type === 'success' && <CheckCircle2 size={18} />}
                {notif.type === 'warning' && <AlertCircle size={18} />}
                {notif.type === 'error' && <ShieldAlert size={18} />}
                {notif.type === 'info' && <Info size={18} />}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className={cn(
                    'text-sm font-black',
                    notif.read ? 'text-slate-600' : 'text-slate-900',
                  )}>
                    {notif.title}
                  </h4>
                  {!notif.read && <div className="w-2 h-2 bg-primary-deep rounded-full ring-4 ring-primary-deep/10" />}
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {notif.description}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                  <Clock size={10} />
                  {notif.time}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
          <button
            type="button"
            disabled={unreadCount === 0 || isMarkingAll}
            onClick={() => void handleMarkAllRead()}
            className={cn(
              'text-[10px] font-black uppercase tracking-widest',
              unreadCount > 0
                ? 'text-primary-deep hover:underline'
                : 'text-slate-300 cursor-not-allowed',
            )}
          >
            {isMarkingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ShieldAlert = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);
