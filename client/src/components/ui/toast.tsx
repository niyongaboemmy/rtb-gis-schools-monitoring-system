import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

export interface ToastOptions {
  /** Optional bold heading shown above the message. */
  title?: string;
  /** Milliseconds before auto-dismiss. Pass 0 to keep it until dismissed. */
  duration?: number;
  /** Optional inline action, e.g. { label: "View", onClick: () => navigate(…) }. */
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  title: string;
  duration: number;
  action?: ToastOptions["action"];
}

type Msg<T> = string | ((value: T) => string);

export interface PromiseMessages<T> {
  loading: string;
  success: Msg<T>;
  /** Defaults to the server's message (via the error's response body) when omitted. */
  error?: Msg<unknown>;
}

export interface ToastContextValue {
  show: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  /** Spinner toast that turns into success/error when the promise settles. Re-throws on failure. */
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions) => Promise<T>;
  /** Changes an existing toast in place (used by `promise`). */
  update: (id: string, variant: ToastVariant, message: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANTS: Record<
  ToastVariant,
  { Icon: typeof Info; tile: string; bar: string; title: string }
> = {
  success: {
    Icon: CheckCircle2,
    tile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    title: "Done",
  },
  error: {
    Icon: XCircle,
    tile: "bg-red-500/12 text-red-600 dark:text-red-400",
    bar: "bg-red-500",
    title: "Something went wrong",
  },
  warning: {
    Icon: AlertTriangle,
    tile: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    title: "Heads up",
  },
  info: {
    Icon: Info,
    tile: "bg-primary/12 text-primary",
    bar: "bg-primary",
    title: "",
  },
  loading: {
    Icon: Loader2,
    tile: "bg-primary/12 text-primary",
    bar: "bg-primary",
    title: "",
  },
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4500,
  warning: 6000,
  error: 7000,
  loading: 0,
};

const MAX_VISIBLE = 4;

/** Best-effort readable message from an API error (axios or plain Error). */
function errorText(err: unknown): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Please try again.";
}

const resolve = <T,>(msg: Msg<T>, value: T) => (typeof msg === "function" ? msg(value) : msg);

/** Imperative handle for code outside React (stores, api helpers). */
let imperative: ToastContextValue | null = null;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, message: string, options?: ToastOptions) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const item: ToastItem = {
      id,
      variant,
      message,
      title: options?.title ?? "",
      duration: options?.duration ?? DEFAULT_DURATION[variant],
      action: options?.action,
    };
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), item]);
    return id;
  }, []);

  const update = useCallback(
    (id: string, variant: ToastVariant, message: string, options?: ToastOptions) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                variant,
                message,
                title: options?.title ?? "",
                duration: options?.duration ?? DEFAULT_DURATION[variant],
                action: options?.action,
              }
            : t,
        ),
      );
    },
    [],
  );

  const promise = useCallback(
    async <T,>(p: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions) => {
      const id = show("loading", messages.loading, { title: options?.title });
      try {
        const value = await p;
        update(id, "success", resolve(messages.success, value), options);
        return value;
      } catch (err) {
        const text = messages.error ? resolve(messages.error, err) : errorText(err);
        update(id, "error", text, { ...options, action: undefined });
        throw err;
      }
    },
    [show, update],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      update,
      promise,
      success: (m, o) => show("success", m, o),
      error: (m, o) => show("error", m, o),
      warning: (m, o) => show("warning", m, o),
      info: (m, o) => show("info", m, o),
    }),
    [show, dismiss, update, promise],
  );

  useEffect(() => {
    imperative = value;
    return () => {
      if (imperative === value) imperative = null;
    };
  }, [value]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={cn(
              "pointer-events-none fixed z-9999 flex flex-col gap-2.5",
              // Phones: full-width, above the home indicator. Desktop: bottom-right stack.
              "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]",
            )}
          >
            {/* Always-mounted live regions so screen readers announce new toasts (WCAG 4.1.3). */}
            <div role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {toasts.map((t) => (
                  <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
                ))}
              </AnimatePresence>
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const reduce = useReducedMotion();
  const v = VARIANTS[t.variant];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.duration);
  const startedAt = useRef(0);
  const bar = useAnimationControls();
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  // A changed toast (e.g. loading → success) starts a fresh countdown.
  useEffect(() => {
    remaining.current = t.duration;
    bar.set({ scaleX: 1 });
  }, [t.duration, t.variant, t.message, bar]);

  // One clock drives both the timer and the bar; hover/focus pauses both.
  useEffect(() => {
    if (t.duration <= 0 || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissRef.current(), remaining.current);
    void bar.start({ scaleX: 0, transition: { duration: remaining.current / 1000, ease: "linear" } });
    return () => {
      clearTimeout(timer);
      bar.stop();
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [t.duration, t.variant, t.message, paused, bar]);

  const title = t.title || (t.variant === "error" || t.variant === "warning" ? v.title : "");
  const isError = t.variant === "error";

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      drag={reduce ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.1, right: 0.9 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90 || info.velocity.x > 600) onDismiss();
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role={isError ? "alert" : "status"}
      aria-atomic="true"
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-3.5 pr-3",
        "border-black/5 bg-white/95 text-slate-900 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/90 dark:text-white dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]",
        "cursor-grab active:cursor-grabbing touch-pan-y",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", v.tile)}>
        <motion.span
          key={t.variant}
          initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="flex"
        >
          <v.Icon className={cn("h-[18px] w-[18px]", t.variant === "loading" && "animate-spin")} aria-hidden />
        </motion.span>
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {title && <p className="text-sm font-semibold leading-5">{title}</p>}
        <p
          className={cn(
            "whitespace-pre-line wrap-break-word text-sm leading-5",
            title ? "mt-0.5 text-slate-600 dark:text-white/70" : "font-medium",
          )}
        >
          {t.message}
        </p>
        {t.action && (
          <button
            type="button"
            onClick={() => {
              t.action?.onClick();
              onDismiss();
            }}
            className="mt-2 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="-mt-0.5 shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-black/5 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      {/* Countdown bar */}
      {t.duration > 0 && !reduce && (
        <motion.span
          className={cn("absolute bottom-0 left-0 h-[3px] w-full origin-left opacity-60", v.bar)}
          initial={{ scaleX: 1 }}
          animate={bar}
        />
      )}
    </motion.div>
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

/**
 * Imperative toasts for code outside React components (e.g. stores). Inside
 * components prefer `useToast()`. Calls before the provider mounts are dropped.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const notify = {
  success: (m: string, o?: ToastOptions) => imperative?.success(m, o),
  error: (m: string, o?: ToastOptions) => imperative?.error(m, o),
  warning: (m: string, o?: ToastOptions) => imperative?.warning(m, o),
  info: (m: string, o?: ToastOptions) => imperative?.info(m, o),
  promise: <T,>(p: Promise<T>, m: PromiseMessages<T>, o?: ToastOptions) =>
    imperative ? imperative.promise(p, m, o) : p,
};
