import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { classNames } from '../../lib/format';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { border: string; icon: ReactNode }> = {
  success: { border: 'border-success/50', icon: <CheckCircle2 aria-hidden className="h-4 w-4 text-success" /> },
  error: { border: 'border-danger/50', icon: <XCircle aria-hidden className="h-4 w-4 text-danger" /> },
  warning: { border: 'border-caution/50', icon: <AlertTriangle aria-hidden className="h-4 w-4 text-caution" /> },
  info: { border: 'border-brand/40', icon: <Info aria-hidden className="h-4 w-4 text-brand" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      if (toast.tone !== 'error') {
        setTimeout(() => remove(id), 6000);
      }
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'error', title, description }),
      info: (title, description) => push({ tone: 'info', title, description }),
      warning: (title, description) => push({ tone: 'warning', title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,26rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={classNames(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-800/95 p-3 shadow-lift backdrop-blur',
              TONE_STYLES[toast.tone].border,
            )}
          >
            <span className="mt-0.5">{TONE_STYLES[toast.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-xs leading-relaxed text-brand/70">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-brand/60 transition-colors hover:bg-ink-700 hover:text-brand"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider.');
  return context;
}
