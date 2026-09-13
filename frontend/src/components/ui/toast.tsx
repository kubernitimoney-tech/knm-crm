import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener([...toasts]);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(input: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}) {
  const item: ToastItem = {
    id: nextId++,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
    duration: input.duration ?? 5000,
  };
  toasts = [...toasts, item];
  emit();
  if (item.duration > 0) {
    setTimeout(() => dismiss(item.id), item.duration);
  }
  return item.id;
}

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-emerald-200 bg-emerald-50',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
  },
  error: {
    ring: 'border-rose-200 bg-rose-50',
    icon: <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />,
  },
  info: {
    ring: 'border-slate-200 bg-white',
    icon: <Info className="w-5 h-5 text-primary-deep shrink-0" />,
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[300] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {items.map((item) => {
        const style = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl shadow-slate-300/30 animate-in slide-in-from-top-2 fade-in duration-300',
              style.ring,
            )}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 leading-snug">{item.title}</p>
              {item.description && (
                <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
