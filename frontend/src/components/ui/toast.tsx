/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

type ToastStore = {
  toasts: ToastItem[];
  listeners: Listener[];
  nextId: number;
};

const TOAST_STORE_KEY = '__knmToastStore';

function getStore(): ToastStore {
  const globalRef = globalThis as typeof globalThis & { [TOAST_STORE_KEY]?: ToastStore };
  if (!globalRef[TOAST_STORE_KEY]) {
    globalRef[TOAST_STORE_KEY] = { toasts: [], listeners: [], nextId: 1 };
  }
  return globalRef[TOAST_STORE_KEY];
}

function emit() {
  const store = getStore();
  for (const listener of store.listeners) listener([...store.toasts]);
}

function dismiss(id: number) {
  const store = getStore();
  store.toasts = store.toasts.filter((item) => item.id !== id);
  emit();
}

export function toast(input: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}) {
  const store = getStore();
  const item: ToastItem = {
    id: store.nextId++,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
    duration: input.duration ?? 6000,
  };
  store.toasts = [...store.toasts, item];
  emit();
  if (item.duration > 0) {
    setTimeout(() => dismiss(item.id), item.duration);
  }
  return item.id;
}

export function sentEmailSuccessTitle(label: string, email?: string | null) {
  const address = (email || '').trim();
  if (!address || address === '—') {
    return `Success: ${label} has been sent`;
  }
  return `Success: ${label} has been sent to ${address}`;
}

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-emerald-300 bg-emerald-50',
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
  const [items, setItems] = useState<ToastItem[]>(() => [...getStore().toasts]);

  useEffect(() => {
    const store = getStore();
    const listener: Listener = (next) => setItems(next);
    store.listeners.push(listener);
    setItems([...store.toasts]);
    return () => {
      store.listeners = store.listeners.filter((entry) => entry !== listener);
    };
  }, []);

  if (typeof document === 'undefined' || items.length === 0) return null;

  return createPortal(
    <div className="fixed top-20 right-5 z-[400] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {items.map((item) => {
        const style = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl shadow-slate-400/40 animate-in slide-in-from-top-2 fade-in duration-300',
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
    </div>,
    document.body,
  );
}
