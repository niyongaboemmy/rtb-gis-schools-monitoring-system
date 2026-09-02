import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  /** Optional bold heading shown above the message. */
  title?: string;
  /** Milliseconds before auto-dismiss. Pass 0 to keep it until dismissed. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "title">> {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastContextValue {
  show: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: React.ReactNode; ring: string; accent: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    ring: "ring-emerald-500/30",
    accent: "text-emerald-500",
  },
  error: {
    icon: <XCircle className="w-5 h-5" />,
    ring: "ring-red-500/30",
    accent: "text-red-500",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    ring: "ring-amber-500/30",
    accent: "text-amber-500",
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    ring: "ring-sky-500/30",
    accent: "text-sky-500",
  },
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const duration = options?.duration ?? DEFAULT_DURATION[variant];
      const item: ToastItem = {
        id,
        variant,
        message,
        title: options?.title ?? "",
        duration,
      };
      setToasts((prev) => [...prev.slice(-3), item]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (m, o) => show("success", m, o),
      error: (m, o) => show("error", m, o),
      warning: (m, o) => show("warning", m, o),
      info: (m, o) => show("info", m, o),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-9999 flex flex-col items-end gap-3 p-4 sm:p-6">
            <div className="mt-auto flex w-full max-w-sm flex-col gap-3">
              <AnimatePresence initial={false}>
                {toasts.map((t) => {
                  const styles = VARIANT_STYLES[t.variant];
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 24, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-black/5 bg-white/95 p-4 shadow-lg ring-1 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 ${styles.ring}`}
                      role="status"
                    >
                      <span className={`mt-0.5 shrink-0 ${styles.accent}`}>
                        {styles.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        {t.title && (
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t.title}
                          </p>
                        )}
                        <p className="whitespace-pre-line wrap-break-word text-sm text-slate-600 dark:text-slate-300">
                          {t.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        aria-label="Dismiss notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
